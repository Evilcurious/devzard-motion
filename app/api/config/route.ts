import { z } from 'zod';
import { guard, errorResponse, readJson } from '@/lib/security';
import { readConnection, saveConnection, removeConnection } from '@/lib/connection-store';
import { aiConfig, type ModelSettings } from '@/lib/ai';
import { validateEndpoint } from '@/lib/endpoint';
import { databaseConfigured } from '@/lib/db';
const schema = z.object({
  provider: z.enum(['openai', 'ollama', 'compatible']),
  model: z.string().trim().min(1).max(100),
  key: z.string().trim().max(500).optional(),
  baseURL: z.string().trim().max(500).optional(),
});
export async function GET() {
  try {
    await guard();
    const config = await aiConfig();
    return Response.json({
      provider: config.provider,
      model: config.model,
      baseURL: config.baseURL,
      keySaved: !!config.key,
      storage: databaseConfigured() ? 'postgresql' : 'cookie',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    await guard(request);
    const input = schema.parse(await readJson(request, 3000));
    const previous = await readConnection<ModelSettings>('model');
    const settings: ModelSettings = {
      provider: input.provider,
      model: input.model,
      key: input.key || (previous?.provider === input.provider ? previous.key : ''),
    };
    if (input.provider === 'ollama') settings.key = '';
    if (input.baseURL) settings.baseURL = validateEndpoint(input.baseURL);
    if (input.provider === 'openai') settings.baseURL = 'https://api.openai.com/v1';
    if (input.provider === 'compatible' && !settings.baseURL && !process.env.AI_BASE_URL)
      throw new Error('Enter your API endpoint, including /v1.');
    if (
      input.provider === 'openai' &&
      !settings.key &&
      !((process.env.AI_PROVIDER || 'openai') === 'openai' && process.env.AI_API_KEY)
    )
      throw new Error('Enter an OpenAI API key, or select Ollama to run without an API key.');
    await saveConnection('model', settings);
    return Response.json({ ok: true, storage: databaseConfigured() ? 'postgresql' : 'cookie' });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request) {
  try {
    await guard(request);
    await removeConnection('model');
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
