import { z } from 'zod';
import { guard, errorResponse, readJson, seal, unseal } from '@/lib/security';
import { getProviderKeys } from '@/lib/provider-credentials';
import { getRouterProvider } from '@/lib/model-router';

export const runtime = 'nodejs';
export const maxDuration = 60;

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('generate'),
    type: z.enum(['image', 'video']),
    prompt: z.string().trim().min(1).max(4000),
  }),
  z.object({ action: z.literal('poll'), token: z.string().min(40).max(2000) }),
]);

type ImageJob = { providerId: 'xkiro'; jobId: string; modelId: string; accountId: string };

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
        body: JSON.stringify({
          model: 'sensenova/sensenova-u1.5-lite',
          prompt,
          n: 1,
          size: '1024x1024',
        }),
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
          status: 'succeeded' as const,
          url,
          providerId: 'xkiro',
          providerName: provider.name,
          modelId: 'sensenova/sensenova-u1.5-lite',
        };
      }
      if (typeof created?.id !== 'string') throw new Error('xKiro did not return an image job ID.');
      const job: ImageJob = {
        providerId: 'xkiro',
        accountId,
        jobId: created.id,
        modelId: 'sensenova/sensenova-u1.5-lite',
      };
      return {
        status: 'processing' as const,
        providerId: 'xkiro',
        providerName: provider.name,
        modelId: job.modelId,
        token: seal(job, 300),
      };
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || !/(401|402|403|429|quota|credit|key)/i.test(error.message))
        throw error;
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
    status: 'succeeded' as const,
    url,
    providerId: 'septorlabs',
    providerName: 'Septor Labs',
    modelId: 'auto',
  };
}

export async function POST(request: Request) {
  try {
    const principal = await guard(request);
    const input = schema.parse(await readJson(request, 5000));
    if (input.action === 'poll') {
      const job = unseal<ImageJob>(input.token);
      if (
        !job ||
        job.accountId !== principal.id ||
        job.providerId !== 'xkiro' ||
        !/^[\w-]{1,120}$/.test(job.jobId)
      )
        return Response.json(
          { error: 'This image job link is invalid or expired. Start a new image request.' },
          { status: 400 },
        );
      const keys = await getProviderKeys('xkiro');
      if (!keys.length)
        return Response.json(
          { error: 'Reconnect xKiro to finish this image job.' },
          { status: 400 },
        );
      return Response.json(await pollXkiroJob(job, keys));
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

    const xkiroKeys = await getProviderKeys('xkiro');
    const septorKeys = await getProviderKeys('septorlabs');
    if (!xkiroKeys.length && !septorKeys.length) {
      return Response.json(
        {
          error:
            'Connect an xKiro or Septor Labs API key in Models & providers to generate images.',
        },
        { status: 400 },
      );
    }
    let lastError: unknown;
    for (const key of xkiroKeys) {
      try {
        return Response.json(await generateXkiroImage(input.prompt, [key], principal.id));
      } catch (error) {
        lastError = error;
        if (!(error instanceof Error) || !/(401|402|403|429|quota|credit|key)/i.test(error.message))
          throw error;
      }
    }
    for (const key of septorKeys) {
      try {
        return Response.json(await generateSeptorImage(input.prompt, key));
      } catch (error) {
        lastError = error;
        if (!(error instanceof Error) || !/(401|402|403|429|quota|credit|key)/i.test(error.message))
          throw error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('All connected image providers failed.');
  } catch (error) {
    return errorResponse(error);
  }
}
