import { createPublicKey, verify } from 'node:crypto';

/**
 * Verified metadata catalog from the FreeLLMAPI project. The catalog is used
 * only to enrich models that the connected provider itself returned; it never
 * creates credentials, marks a provider route eligible, or overrides live
 * provider quota/depletion signals.
 *
 * Upstream project: https://github.com/tashfeenahmed/freellmapi (MIT).
 */
const DEFAULT_CATALOG_URL = 'https://api.freellmapi.co/v1/latest';
const PINNED_CATALOG_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAq9yv4+3EeyMHKsfVYBhkcz1lYgIXSUeHNnN6tNgYX3k=
-----END PUBLIC KEY-----`;
const MAX_CATALOG_BYTES = 8 * 1024 * 1024;
const MAX_CATALOG_MODELS = 10_000;
const CACHE_MS = 6 * 60 * 60 * 1000;

export type FreeLlmCatalogModel = {
  platform: string;
  modelId: string;
  displayName: string;
  monthlyTokenBudget: string | null;
  contextWindow: number | null;
  supportsVision: boolean;
  supportsTools: boolean;
  enabled: boolean;
  limits: { rpm: number | null; rpd: number | null; tpm: number | null; tpd: number | null };
};

export type FreeLlmCatalog = {
  version: string;
  generatedAt: string;
  tier: 'live' | 'monthly';
  models: FreeLlmCatalogModel[];
};

type GlobalCache = typeof globalThis & {
  relayFreeLlmCatalog?: { loadedAt: number; catalog: FreeLlmCatalog };
  relayFreeLlmCatalogPromise?: Promise<FreeLlmCatalog>;
};
const globalCache = globalThis as GlobalCache;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function nullablePositiveInteger(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) return undefined;
  return value;
}

function parseModel(value: unknown): FreeLlmCatalogModel | null {
  if (!isRecord(value) || !isRecord(value.limits)) return null;
  const {
    platform,
    modelId,
    displayName,
    monthlyTokenBudget,
    contextWindow,
    supportsVision,
    supportsTools,
    enabled,
  } = value;
  if (
    typeof platform !== 'string' ||
    !/^[a-z0-9][a-z0-9_-]{0,49}$/i.test(platform) ||
    typeof modelId !== 'string' ||
    !modelId.trim() ||
    modelId.length > 256 ||
    typeof displayName !== 'string' ||
    displayName.length > 200 ||
    !(monthlyTokenBudget === null || typeof monthlyTokenBudget === 'string') ||
    !(
      contextWindow === null ||
      (typeof contextWindow === 'number' &&
        Number.isSafeInteger(contextWindow) &&
        contextWindow > 0)
    ) ||
    typeof supportsVision !== 'boolean' ||
    typeof supportsTools !== 'boolean' ||
    typeof enabled !== 'boolean'
  )
    return null;
  const limits = value.limits;
  const rpm = nullablePositiveInteger(limits.rpm);
  const rpd = nullablePositiveInteger(limits.rpd);
  const tpm = nullablePositiveInteger(limits.tpm);
  const tpd = nullablePositiveInteger(limits.tpd);
  if ([rpm, rpd, tpm, tpd].some((limit) => limit === undefined)) return null;
  return {
    platform,
    modelId: modelId.trim(),
    displayName: displayName.trim() || modelId.trim(),
    monthlyTokenBudget:
      typeof monthlyTokenBudget === 'string' ? monthlyTokenBudget.slice(0, 80) : null,
    contextWindow: contextWindow as number | null,
    supportsVision,
    supportsTools,
    enabled,
    limits: { rpm: rpm!, rpd: rpd!, tpm: tpm!, tpd: tpd! },
  };
}

export function parseSignedFreeLlmCatalog(
  bytes: Uint8Array,
  signature: string | null,
  publicKeyPem = PINNED_CATALOG_PUBLIC_KEY,
): FreeLlmCatalog {
  if (!signature || signature.length > 2048 || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature))
    throw new Error('FreeLLMAPI catalog signature is missing or malformed.');
  if (bytes.byteLength > MAX_CATALOG_BYTES)
    throw new Error('FreeLLMAPI catalog exceeds the size limit.');
  const publicKey = createPublicKey({ key: publicKeyPem, format: 'pem' });
  if (!verify(null, bytes, publicKey, Buffer.from(signature, 'base64')))
    throw new Error('FreeLLMAPI catalog signature verification failed.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    throw new Error('FreeLLMAPI catalog is not valid JSON.');
  }
  if (
    !isRecord(parsed) ||
    typeof parsed.version !== 'string' ||
    parsed.version.length > 40 ||
    typeof parsed.generatedAt !== 'string' ||
    !Number.isFinite(Date.parse(parsed.generatedAt)) ||
    (parsed.tier !== 'live' && parsed.tier !== 'monthly') ||
    !Array.isArray(parsed.models) ||
    parsed.models.length > MAX_CATALOG_MODELS
  )
    throw new Error('FreeLLMAPI catalog has an unsupported shape.');

  // Chat models are the catalog records that can contribute metadata to Relay's
  // chat router; media and transcription catalogs need separate routing APIs.
  const chatRecords = parsed.models.filter(
    (entry) =>
      !isRecord(entry) ||
      !['image', 'audio', 'transcription', 'video'].includes(String(entry.modality || '')),
  );
  const models = chatRecords.map(parseModel);
  if (models.some((model) => model === null))
    throw new Error('FreeLLMAPI catalog contains an invalid model entry.');
  return {
    version: parsed.version,
    generatedAt: parsed.generatedAt,
    tier: parsed.tier,
    models: models as FreeLlmCatalogModel[],
  };
}

async function readBoundedBody(response: Response): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CATALOG_BYTES)
    throw new Error('FreeLLMAPI catalog exceeds the size limit.');
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_CATALOG_BYTES)
      throw new Error('FreeLLMAPI catalog exceeds the size limit.');
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_CATALOG_BYTES) {
        await reader.cancel();
        throw new Error('FreeLLMAPI catalog exceeds the size limit.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function fetchFreeLlmCatalog(fetcher: typeof fetch = fetch): Promise<FreeLlmCatalog> {
  const cached = globalCache.relayFreeLlmCatalog;
  if (cached && Date.now() - cached.loadedAt < CACHE_MS) return cached.catalog;
  if (globalCache.relayFreeLlmCatalogPromise) return globalCache.relayFreeLlmCatalogPromise;

  const load = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetcher(DEFAULT_CATALOG_URL, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`FreeLLMAPI catalog returned HTTP ${response.status}.`);
      const catalog = parseSignedFreeLlmCatalog(
        await readBoundedBody(response),
        response.headers.get('x-catalog-signature'),
      );
      globalCache.relayFreeLlmCatalog = { loadedAt: Date.now(), catalog };
      return catalog;
    } catch (error) {
      if (cached) return cached.catalog;
      throw error instanceof Error ? error : new Error('FreeLLMAPI catalog could not be loaded.');
    } finally {
      clearTimeout(timeout);
      globalCache.relayFreeLlmCatalogPromise = undefined;
    }
  };

  globalCache.relayFreeLlmCatalogPromise = load();
  return globalCache.relayFreeLlmCatalogPromise;
}
