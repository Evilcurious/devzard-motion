import { z } from 'zod';
import { aiConfig } from '@/lib/ai';
import { isFreeLLMAPIEndpoint } from '@/lib/ai-errors';
import { loadFreeLLMAPImodels } from '@/lib/free-llmapi-models';
import { errorResponse, guard, readJson } from '@/lib/security';

export const runtime = 'nodejs';
const schema = z.object({ key: z.string().trim().max(500).optional() }).strict();

export async function POST(request: Request) {
  try {
    await guard(request);
    const input = schema.safeParse(await readJson(request, 3000));
    if (!input.success)
      throw new Error('Enter a valid FreeLLMAPI key. No custom model URL is accepted.');
    let key = input.data.key || '';
    if (!key) {
      const config = await aiConfig();
      if (config.provider === 'compatible' && isFreeLLMAPIEndpoint(config.baseURL))
        key = config.key;
    }
    const models = await loadFreeLLMAPImodels(key);
    return Response.json({ models }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
