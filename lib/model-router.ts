export type RouterProviderId =
  | 'openrouter'
  | 'ollama-cloud'
  | 'kilo'
  | 'ovh'
  | 'agnes'
  | 'routeway'
  | 'bazaarlink'
  | 'requesty'
  | 'aihorde'
  | 'electronhub'
  | 'xkiro'
  | 'septorlabs'
  | 'firecrawl'
  | 'parallel'
  | 'keenable'
  | 'gemini';
export type RouterProviderCategory = 'models' | 'search';
export type RouterProvider = {
  id: RouterProviderId;
  name: string;
  category: RouterProviderCategory;
  baseURL: string | null;
  modelsPath?: string;
  keyRequired: boolean;
  docsURL: string;
  note?: string;
  userAgent?: string;
};

// Provider hosts are fixed in code so saved keys can never be sent to a
// user-supplied destination. Unknown providers can be added as reviewed
// templates in this registry; editable URLs continue to use AI_ALLOWED_ORIGINS.
export const routerProviders: RouterProvider[] = [
  {
    id: 'gemini',
    name: 'Google Gemini API',
    category: 'models',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    modelsPath: '/v1beta/models?pageSize=1000',
    keyRequired: true,
    docsURL: 'https://aistudio.google.com/app/apikey',
    note: 'Only models with API-reported free access or positive remaining quota are selectable.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'models',
    baseURL: 'https://openrouter.ai/api/v1',
    modelsPath: '/api/v1/models/user?limit=500',
    keyRequired: true,
    docsURL: 'https://openrouter.ai/settings/keys',
  },
  {
    id: 'ollama-cloud',
    name: 'Ollama Cloud',
    category: 'models',
    baseURL: 'https://ollama.com/v1',
    keyRequired: true,
    docsURL: 'https://ollama.com/settings/keys',
    note: 'Recognizes Ollama’s documented free-usage-credit models when listed for your key; those models consume account free credits.',
  },
  {
    id: 'kilo',
    name: 'Kilo Gateway',
    category: 'models',
    baseURL: 'https://api.kilo.ai/api/gateway/v1',
    modelsPath: '/api/gateway/models',
    keyRequired: false,
    docsURL: 'https://app.kilo.ai',
    note: 'Anonymous free routes may be rate-limited.',
  },
  {
    id: 'ovh',
    name: 'OVH AI Endpoints',
    category: 'models',
    baseURL: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1',
    keyRequired: false,
    docsURL: 'https://endpoints.ai.cloud.ovh.net',
  },
  {
    id: 'agnes',
    name: 'Agnes AI',
    category: 'models',
    baseURL: 'https://apihub.agnes-ai.com/v1',
    keyRequired: true,
    docsURL: 'https://platform.agnes-ai.com',
  },
  {
    id: 'routeway',
    name: 'Routeway',
    category: 'models',
    baseURL: 'https://api.routeway.ai/v1',
    keyRequired: true,
    docsURL: 'https://routeway.ai',
    userAgent: 'Mozilla/5.0 Relay/1.0',
  },
  {
    id: 'bazaarlink',
    name: 'BazaarLink',
    category: 'models',
    baseURL: 'https://bazaarlink.ai/api/v1',
    keyRequired: true,
    docsURL: 'https://bazaarlink.ai',
  },
  {
    id: 'requesty',
    name: 'Requesty',
    category: 'models',
    baseURL: 'https://router.requesty.ai/v1',
    keyRequired: true,
    docsURL: 'https://requesty.ai',
  },
  {
    id: 'aihorde',
    name: 'AI Horde',
    category: 'models',
    baseURL: 'https://oai.aihorde.net/v1',
    keyRequired: false,
    docsURL: 'https://aihorde.net/register',
    note: 'Volunteer-powered; responses can be slow and tools are not supported.',
  },
  {
    id: 'electronhub',
    name: 'Electron Hub',
    category: 'models',
    baseURL: 'https://api.electronhub.ai/v1',
    keyRequired: true,
    docsURL: 'https://app.electronhub.ai',
    note: 'Only models reported free or with remaining-token data are shown.',
  },
  {
    id: 'xkiro',
    name: 'xKiro',
    category: 'models',
    baseURL: 'https://api.xkiro.com/v1',
    modelsPath: '/v1/models?modality=chat',
    keyRequired: true,
    docsURL: 'https://docs.xkiro.com/',
    note: 'OpenAI-compatible chat models; image generation is available through a separate image job API.',
  },
  {
    id: 'septorlabs',
    name: 'Septor Labs',
    category: 'models',
    baseURL: 'https://api.septorlabs.com/v1',
    keyRequired: true,
    docsURL: 'https://septorlabs.com/docs/introduction',
    note: 'OpenAI-compatible model gateway with image generation on paid plans.',
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    category: 'search',
    baseURL: 'https://api.firecrawl.dev/v2',
    keyRequired: true,
    docsURL: 'https://docs.firecrawl.dev/api-reference/endpoint/search',
    note: 'Web search is called when you turn on Search the web in chat.',
  },
  {
    id: 'parallel',
    name: 'Parallel',
    category: 'search',
    baseURL: null,
    keyRequired: true,
    docsURL: 'https://parallel.ai',
    note: 'Search credential storage only; Relay does not invoke this API yet.',
  },
  {
    id: 'keenable',
    name: 'KeenAble',
    category: 'search',
    baseURL: null,
    keyRequired: true,
    docsURL: 'https://keenable.com',
    note: 'Search credential storage only; Relay does not invoke this API yet.',
  },
];

export type RouterModel = {
  key: string;
  id: string;
  name: string;
  providers: Array<{
    id: RouterProviderId;
    name: string;
    modelId: string;
    contextTokens: number | null;
    availableTokens: number | null;
    supportsTools: boolean | null;
    isFree: boolean;
    accountCreditsAvailable?: boolean;
  }>;
  contextTokens: number | null;
  availableTokens: number | null;
  isFree: boolean;
};
export type RouterStrategy = 'auto' | 'fusion';
export type AIDensity = 'auto' | 'fast' | 'faster' | 'high' | 'slow';
export type RouterTarget = {
  providerId: RouterProviderId;
  modelId: string;
  availableTokens?: number | null;
  contextTokens?: number | null;
  supportsTools?: boolean | null;
  isFree?: boolean;
  accountCreditsAvailable?: boolean;
};
export type RouterSelection = RouterTarget & {
  strategy: RouterStrategy;
  autoPick?: boolean;
  fusionModels: RouterTarget[];
};

export function selectRouterCandidates<T extends RouterTarget>(
  ranked: T[],
  selected: RouterTarget | null,
  autoPick: boolean,
) {
  if (autoPick) return ranked;
  if (!selected) return [];
  const key = `${selected.providerId}::${selected.modelId}`;
  const pinned = ranked.find((target) => `${target.providerId}::${target.modelId}` === key);
  return pinned ? [pinned] : [];
}

export function rankRouterTargets<T extends RouterTarget>(
  targets: T[],
  density: AIDensity,
  measuredLatencyMs: ReadonlyMap<string, number> = new Map(),
): T[] {
  const eligible = targets.filter((target) => target.availableTokens !== 0);
  return eligible
    .map((target, index) => ({ target, index }))
    .sort((a, b) => {
      const quotaA = a.target.availableTokens;
      const quotaB = b.target.availableTokens;
      const quotaRankA = quotaA === null || quotaA === undefined ? 1 : 0;
      const quotaRankB = quotaB === null || quotaB === undefined ? 1 : 0;
      if (quotaRankA !== quotaRankB) return quotaRankA - quotaRankB;
      const compareQuota = () =>
        quotaA !== null &&
        quotaA !== undefined &&
        quotaB !== null &&
        quotaB !== undefined &&
        quotaA !== quotaB
          ? quotaB - quotaA
          : 0;
      const compareLatency = () => {
        const latencyA = measuredLatencyMs.get(`${a.target.providerId}::${a.target.modelId}`);
        const latencyB = measuredLatencyMs.get(`${b.target.providerId}::${b.target.modelId}`);
        if (latencyA === undefined && latencyB !== undefined) return 1;
        if (latencyB === undefined && latencyA !== undefined) return -1;
        return latencyA !== undefined && latencyB !== undefined ? latencyA - latencyB : 0;
      };
      if (density === 'faster') {
        const latencyOrder = compareLatency();
        if (latencyOrder) return latencyOrder;
        const quotaOrder = compareQuota();
        if (quotaOrder) return quotaOrder;
      } else if (density === 'high') {
        const contextA = a.target.contextTokens ?? -1;
        const contextB = b.target.contextTokens ?? -1;
        if (contextA !== contextB) return contextB - contextA;
        const quotaOrder = compareQuota();
        if (quotaOrder) return quotaOrder;
      } else {
        const quotaOrder = compareQuota();
        if (quotaOrder) return quotaOrder;
        if (density === 'fast') {
          const latencyOrder = compareLatency();
          if (latencyOrder) return latencyOrder;
        }
        if (density === 'slow') {
          const contextA = a.target.contextTokens ?? -1;
          const contextB = b.target.contextTokens ?? -1;
          if (contextA !== contextB) return contextB - contextA;
        }
      }
      const freeRankA = a.target.isFree ? 0 : 1;
      const freeRankB = b.target.isFree ? 0 : 1;
      if (freeRankA !== freeRankB) return freeRankA - freeRankB;
      return a.index - b.index;
    })
    .map(({ target }) => target);
}

export function getRouterProvider(id: string): RouterProvider | undefined {
  return routerProviders.find((provider) => provider.id === id);
}

export function canonicalModelKey(modelId: string): string {
  return modelId.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

const POSITIVE_CREDIT_FIELDS = new Set([
  'availablebalance',
  'availablecredits',
  'availabletokens',
  'balance',
  'creditsavailable',
  'creditsremaining',
  'limitremaining',
  'quotaavailable',
  'quotaremaining',
  'remainingbalance',
  'remainingcredits',
  'remainingquota',
  'remainingtokens',
  'tokensremaining',
]);
const POSITIVE_REMAINING_PERCENT_FIELDS = new Set([
  'creditsremainingpercent',
  'remainingpercent',
  'remainingpercentage',
  'quotaremainingpercent',
  'quotaremainingpercentage',
]);
const ACCOUNT_QUOTA_CONTAINERS = new Set([
  'account',
  'balance',
  'billing',
  'credits',
  'data',
  'freecredits',
  'freeusage',
  'limit',
  'limits',
  'meta',
  'metadata',
  'plan',
  'quota',
  'usage',
]);

function finiteNumber(value: unknown) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Detect explicit positive provider/account credit fields across common response wrappers. */
export function hasPositiveAccountCredits(body: unknown): boolean {
  const pending: Array<{ value: unknown; depth: number; quotaContext: boolean }> = [
    { value: body, depth: 0, quotaContext: false },
  ];
  const seen = new Set<object>();
  while (pending.length) {
    const current = pending.pop()!;
    if (!current.value || typeof current.value !== 'object' || Array.isArray(current.value))
      continue;
    if (seen.has(current.value)) continue;
    seen.add(current.value);
    const record = current.value as Record<string, unknown>;
    const normalizedKeys = new Map(
      Object.entries(record).map(([key, value]) => [
        key.toLowerCase().replace(/[^a-z0-9]/g, ''),
        value,
      ]),
    );
    for (const [key, value] of normalizedKeys) {
      const number = finiteNumber(value);
      if (number !== null && POSITIVE_CREDIT_FIELDS.has(key) && number > 0) return true;
      if (
        number !== null &&
        POSITIVE_REMAINING_PERCENT_FIELDS.has(key) &&
        number > 0 &&
        number <= 100
      )
        return true;
    }
    const totalCredits = finiteNumber(normalizedKeys.get('totalcredits'));
    const totalUsage = finiteNumber(normalizedKeys.get('totalusage'));
    if (totalCredits !== null && totalUsage !== null && totalCredits - totalUsage > 0) return true;
    if (current.quotaContext) {
      const usagePercent = finiteNumber(
        normalizedKeys.get('usagepercent') ??
          normalizedKeys.get('usedpercent') ??
          normalizedKeys.get('percentused') ??
          normalizedKeys.get('percentageused') ??
          normalizedKeys.get('usagepercentage'),
      );
      if (usagePercent !== null && usagePercent >= 0 && usagePercent < 100) return true;
      const remaining = finiteNumber(normalizedKeys.get('remaining'));
      const limit = finiteNumber(normalizedKeys.get('limit'));
      const used = finiteNumber(normalizedKeys.get('used'));
      const total = finiteNumber(normalizedKeys.get('total'));
      if (remaining !== null && remaining > 0) return true;
      if (limit !== null && used !== null && limit - used > 0) return true;
      if (total !== null && used !== null && total - used > 0) return true;
    }
    if (current.depth < 4)
      for (const [key, value] of normalizedKeys)
        if (
          ACCOUNT_QUOTA_CONTAINERS.has(key) &&
          value &&
          typeof value === 'object' &&
          !Array.isArray(value)
        )
          pending.push({
            value,
            depth: current.depth + 1,
            quotaContext: current.quotaContext || key !== 'data',
          });
  }
  return false;
}

export function routerModelIds(body: unknown): Array<{
  id: string;
  name: string;
  contextTokens: number | null;
  availableTokens: number | null;
  supportsTools: boolean | null;
  isFree: boolean;
}> {
  const wrappedEntries =
    body && typeof body === 'object' && !Array.isArray(body)
      ? ['data', 'models', 'items', 'results', 'model_list', 'modelList']
          .map((key) => (body as Record<string, unknown>)[key])
          .find(Array.isArray)
      : null;
  const entries = Array.isArray(body) ? body : Array.isArray(wrappedEntries) ? wrappedEntries : [];
  const output = new Map<
    string,
    {
      id: string;
      name: string;
      contextTokens: number | null;
      availableTokens: number | null;
      supportsTools: boolean | null;
      isFree: boolean;
    }
  >();
  for (const item of entries.slice(0, 2000)) {
    if (!item || typeof item !== 'object') continue;
    const itemRecord = item as Record<string, unknown>;
    const rawId =
      typeof itemRecord.id === 'string'
        ? itemRecord.id
        : typeof itemRecord.name === 'string'
          ? itemRecord.name
          : itemRecord.model;
    if (typeof rawId !== 'string') continue;
    const id = rawId.trim();
    if (!id || id.length > 200 || !/^[\w./:-]+$/.test(id)) continue;
    const nestedRecords = [
      itemRecord,
      itemRecord.metadata,
      itemRecord.quota,
      itemRecord.limits,
      itemRecord.usage,
      itemRecord.availability,
      itemRecord.entitlement,
    ].filter(
      (value): value is Record<string, unknown> =>
        !!value && typeof value === 'object' && !Array.isArray(value),
    );
    const findField = (keys: string[]) => {
      for (const record of nestedRecords)
        for (const key of keys)
          if (key in record && record[key] !== undefined && record[key] !== null)
            return record[key];
      return null;
    };
    const rawContext = findField(['context_length', 'context_window', 'contextWindow']);
    const context = finiteNumber(rawContext);
    const contextTokens =
      context !== null && Number.isSafeInteger(context) && context > 0 ? context : null;
    const rawAvailable = findField([
      'available_tokens',
      'remaining_tokens',
      'monthly_tokens_remaining',
      'tokens_remaining',
      'quota_remaining',
      'remaining_quota',
      'free_tokens_remaining',
      'limit_remaining',
    ]);
    const available = finiteNumber(rawAvailable);
    const availableTokens =
      available !== null && Number.isSafeInteger(available) && available >= 0 ? available : null;
    const rawSupportsTools = findField(['supports_tools', 'supportsTools', 'tool_calling']);
    const supportsTools = typeof rawSupportsTools === 'boolean' ? rawSupportsTools : null;
    const pricing = findField(['pricing', 'cost']);
    const prices =
      pricing && typeof pricing === 'object'
        ? ['prompt', 'completion', 'input', 'output']
            .map((key) => (pricing as Record<string, unknown>)[key])
            .filter((value) => value !== undefined && value !== null)
            .map((value) => (typeof value === 'string' ? Number(value) : value))
        : [];
    const isFree =
      id.toLowerCase().endsWith(':free') ||
      nestedRecords.some(
        (record) =>
          record.free === true ||
          record.is_free === true ||
          record.isFree === true ||
          record.free_tier === true ||
          record.free_usage_eligible === true,
      ) ||
      (prices.length >= 2 && prices.every((value) => typeof value === 'number' && value === 0));
    if (!output.has(id))
      output.set(id, {
        id,
        name: 'name' in item && typeof item.name === 'string' ? item.name.slice(0, 160) : id,
        contextTokens,
        availableTokens,
        supportsTools,
        isFree,
      });
  }
  return [...output.values()];
}
