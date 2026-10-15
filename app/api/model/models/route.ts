import { z } from 'zod';
import { aiConfig } from '@/lib/ai';
import { isGeminiEndpoint } from '@/lib/ai-errors';
import { loadGeminiModels } from '@/lib/gemini-models';
import { errorResponse, guard, readJson } from '@/lib/security';

export const runtime = 'nodejs';
const schema = z.object({ key: z.string().trim().max(500).optional() }).strict();

export async function POST(request: Request) {
  try {
    await guard(request);
    const input = schema.safeParse(await readJson(request, 3000));
    if (!input.success)
      throw new Error('Enter a valid Gemini key. No custom catalog URL is accepted.');
    let key = input.data.key || '';
    if (!key) {
      const config = await aiConfig();
      // Never reuse credentials from OpenAI or another compatible endpoint for Google.
      if (config.provider === 'compatible' && isGeminiEndpoint(config.baseURL)) key = config.key;
    }
    const models = await loadGeminiModels(key);
    return Response.json({ models }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
