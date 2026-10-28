import { z } from 'zod';
import { guard, errorResponse, readJson, seal, unseal } from '@/lib/security';
import { getAdminProviderKeys, getProviderKeys } from '@/lib/provider-credentials';
import { getRouterProvider } from '@/lib/model-router';
import { accountDatabaseHealth } from '@/lib/tenant-database';
import {
  canTryAnotherImageProvider,
  XKIRO_IMAGE_MODEL_ID,
  xkiroImageGenerationRequest,
} from '@/lib/media-generation';

export const runtime = 'nodejs';
export const maxDuration = 60;

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('generate'),
    type: z.enum(['image', 'video']),
    prompt: z.string().trim().min(1).max(4000),
  }),
  z.object({ action: z.literal('poll'), token: z.string().min(40).max(20_000) }),
]);

type ImageOutput = {
  url: string;
  providerId: 'xkiro' | 'septorlabs';
  providerName: string;
  modelId: string;
};
type ImageJob = { providerId: 'xkiro'; jobId: string; modelId: string; accountId: string };
type ImageBatchJob = {
  kind: 'relay-image-batch';
  accountId: string;
  jobs: ImageJob[];
  outputs: ImageOutput[];
  prompt?: string;
  partial?: boolean;
};

async function providerKeys(
  providerId: 'xkiro' | 'septorlabs',
  principal: Awaited<ReturnType<typeof guard>>,
) {
  const ownKeys = await getProviderKeys(providerId);
  if (principal.role !== 'user' || principal.plan !== 'premium') return ownKeys;
  const adminKeys = await getAdminProviderKeys(providerId);
  return [...new Set([...ownKeys, ...adminKeys])];
}
function hideProviderDetails<T extends object>(
  result: T,
  principal: Awaited<ReturnType<typeof guard>>,
) {
  if (principal.role !== 'user' || principal.plan !== 'premium') return result;
  const {
    providerId: _providerId,
    providerName: _providerName,
    ...safe
  } = result as T & {
    providerId?: unknown;
    providerName?: unknown;
  };
  return safe;
}

function apiError(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string') return error.slice(0, 300);
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
    )
      return error.message.slice(0, 300);
  }
  return fallback;
}

async function pollXkiroJob(job: ImageJob, keys: string[]) {
  const provider = getRouterProvider('xkiro')!;
  let lastError: unknown;
  for (const key of keys) {
    try {
      const response = await fetch(
        `${provider.baseURL}/images/generations/${encodeURIComponent(job.jobId)}`,
        {
          headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
          redirect: 'error',
        },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(apiError(result, `xKiro image status returned HTTP ${response.status}.`));
      if (result?.status === 'succeeded') {
        const url = result.data?.[0]?.url;
        if (typeof url !== 'string' || !url.startsWith('https://'))
          throw new Error('xKiro completed the image job but did not return a secure image URL.');
        return {
          status: 'succeeded' as const,
          url,
          providerId: 'xkiro',
          providerName: provider.name,
          modelId: job.modelId,
        };
      }
      if (result?.status === 'failed' || result?.status === 'blocked')
        throw new Error(apiError(result, `Image generation ${result.status}.`));
      return { status: 'processing' as const };
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || !/(401|402|403|429|quota|credit|key)/i.test(error.message))
        throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All saved xKiro keys were rejected.');
}

async function generateXkiroImage(prompt: string, keys: string[], accountId: string) {
  const provider = getRouterProvider('xkiro')!;
  let lastError: unknown;
  for (const key of keys) {
    try {
      const response = await fetch(`${provider.baseURL}/images/generations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(xkiroImageGenerationRequest(prompt)),
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
      });
      const created = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(apiError(created, `xKiro returned HTTP ${response.status}.`));
      if (created?.status === 'succeeded' && typeof created.data?.[0]?.url === 'string') {
        const url = created.data[0].url as string;
        if (!url.startsWith('https://')) throw new Error('xKiro returned an insecure image URL.');
        return {
          output: {
            url,
            providerId: 'xkiro' as const,
            providerName: provider.name,
            modelId: XKIRO_IMAGE_MODEL_ID,
          },
        };
      }
      if (typeof created?.id !== 'string') throw new Error('xKiro did not return an image job ID.');
      const job: ImageJob = {
        providerId: 'xkiro',
        accountId,
        jobId: created.id,
        modelId: XKIRO_IMAGE_MODEL_ID,
      };
      return { job };
    } catch (error) {
      lastError = error;
      if (!canTryAnotherImageProvider(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All saved xKiro keys were rejected.');
}

async function generateSeptorImage(prompt: string, key: string) {
  const baseURL = getRouterProvider('septorlabs')!.baseURL!;
  const response = await fetch(`${baseURL}/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'auto',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    }),
    signal: AbortSignal.timeout(50_000),
    redirect: 'error',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(apiError(data, `Septor Labs returned HTTP ${response.status}.`));
  const url = data?.data?.[0]?.url;
  if (typeof url !== 'string' || !url.startsWith('https://'))
    throw new Error('Septor Labs did not return a secure image URL.');
  return {
    url,
    providerId: 'septorlabs' as const,
    providerName: 'Septor Labs',
    modelId: 'auto',
  };
}

async function generateSeptorImageWithKeys(prompt: string, keys: string[]) {
  let lastError: unknown;
  for (const key of keys) {
    try {
      return await generateSeptorImage(prompt, key);
    } catch (error) {
      lastError = error;
      if (!canTryAnotherImageProvider(error)) throw error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('All saved Septor Labs keys were rejected.');
}

async function generateAcrossImageProviders(
  prompt: string,
  xkiroKeys: string[],
  septorKeys: string[],
  accountId: string,
) {
  let lastError: unknown;
  if (xkiroKeys.length) {
    try {
      const result = await generateXkiroImage(prompt, xkiroKeys, accountId);
      if ('job' in result && result.job) {
        const batch: ImageBatchJob = {
          kind: 'relay-image-batch',
          accountId,
          jobs: [result.job],
          outputs: [],
          prompt,
        };
        return {
          status: 'processing' as const,
          providerId: 'xkiro',
          providerName: getRouterProvider('xkiro')!.name,
          modelId: result.job.modelId,
          token: seal(batch, 600),
          completedCount: 0,
          totalCount: 1,
        };
      }
      if ('output' in result && result.output)
        return {
          status: 'succeeded' as const,
          providerId: result.output.providerId,
          providerName: result.output.providerName,
          modelId: result.output.modelId,
          urls: [result.output.url],
          partial: false,
        };
    } catch (error) {
      lastError = error;
      if (!canTryAnotherImageProvider(error)) throw error;
    }
  }
  if (septorKeys.length) {
    try {
      const output = await generateSeptorImageWithKeys(prompt, septorKeys);
      return {
        status: 'succeeded' as const,
        providerId: output.providerId,
        providerName: output.providerName,
        modelId: output.modelId,
        urls: [output.url],
        partial: false,
      };
    } catch (error) {
      lastError = error;
      if (!canTryAnotherImageProvider(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All connected image providers failed.');
}

export async function POST(request: Request) {
  try {
    const principal = await guard(request);
    const input = schema.parse(await readJson(request, 24_000));
    if (
      input.action === 'generate' &&
      principal.role === 'user' &&
      principal.plan === 'free' &&
      !(await accountDatabaseHealth(principal.id)).ready
    )
      return Response.json(
        {
          error: 'Connect a reachable personal PostgreSQL database before starting an agent task.',
        },
        { status: 428 },
      );
    if (input.action === 'poll') {
      const decoded = unseal<ImageBatchJob | ImageJob>(input.token);
      const batch: ImageBatchJob | null =
        decoded && 'kind' in decoded && decoded.kind === 'relay-image-batch'
          ? decoded
          : decoded && 'jobId' in decoded
            ? {
                kind: 'relay-image-batch',
                accountId: decoded.accountId,
                jobs: [decoded],
                outputs: [],
              }
            : null;
      if (
        !batch ||
        batch.accountId !== principal.id ||
        batch.jobs.length > 4 ||
        batch.jobs.some(
          (job) =>
            job.providerId !== 'xkiro' ||
            job.accountId !== principal.id ||
            !/^[\w-]{1,120}$/.test(job.jobId),
        ) ||
        batch.outputs.length > 4 ||
        batch.outputs.some((output) => !output.url.startsWith('https://'))
      )
        return Response.json(
          { error: 'This image job link is invalid or expired. Start a new image request.' },
          { status: 400 },
        );
      const keys = await providerKeys('xkiro', principal);
      if (batch.jobs.length && !keys.length)
        return Response.json(
          { error: 'Reconnect xKiro to finish this image job.' },
          { status: 400 },
        );
      const polled = await Promise.allSettled(
        batch.jobs.map(async (job) => ({ job, result: await pollXkiroJob(job, keys) })),
      );
      const outputs = [...batch.outputs];
      const pending: ImageJob[] = [];
      let pollError: unknown;
      for (const item of polled) {
        if (item.status === 'rejected') {
          pollError = item.reason;
          continue;
        }
        if (item.value.result.status === 'processing') pending.push(item.value.job);
        else
          outputs.push({
            url: item.value.result.url,
            providerId: 'xkiro',
            providerName: getRouterProvider('xkiro')!.name,
            modelId: item.value.job.modelId,
          });
      }
      if (!pending.length && pollError && batch.prompt && canTryAnotherImageProvider(pollError)) {
        const septorKeys = await providerKeys('septorlabs', principal);
        if (septorKeys.length) {
          const fallbackOutput = await generateSeptorImageWithKeys(batch.prompt, septorKeys);
          outputs.push(fallbackOutput);
          pollError = null;
        }
      }
      if (pending.length)
        return Response.json({ status: 'processing', completedCount: outputs.length });
      if (!outputs.length)
        throw pollError instanceof Error ? pollError : new Error('All image jobs failed.');
      return Response.json(
        hideProviderDetails(
          {
            status: 'succeeded',
            providerId: 'image-backends',
            providerName: [...new Set(outputs.map((output) => output.providerName))].join(' + '),
            modelId: [...new Set(outputs.map((output) => output.modelId))].join(' + '),
            urls: outputs.map((output) => output.url),
            partial: batch.partial || !!pollError,
          },
          principal,
        ),
      );
    }
    if (input.type === 'video') {
      return Response.json(
        {
          error:
            'Video generation is not available yet: none of the connected providers has a verified video-generation endpoint in Relay. No provider request was made.',
        },
        { status: 409 },
      );
    }

    const xkiroKeys = await providerKeys('xkiro', principal);
    const septorKeys = await providerKeys('septorlabs', principal);
    if (!xkiroKeys.length && !septorKeys.length) {
      return Response.json(
        {
          error:
            'Connect an xKiro or Septor Labs API key in Models & providers. Image generation uses a dedicated image model, not your chat model.',
        },
        { status: 400 },
      );
    }
    const result = await generateAcrossImageProviders(
      input.prompt,
      xkiroKeys,
      septorKeys,
      principal.id,
    );
    return Response.json(hideProviderDetails(result, principal));
  } catch (error) {
    return errorResponse(error);
  }
}
