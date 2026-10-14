import { z } from 'zod';
import { cookies } from 'next/headers';
import { guard, errorResponse, readJson, seal, unseal, cookieOptions } from '@/lib/security';
import type { ModelSettings } from '@/lib/ai';
const schema = z.object({
  provider: z.enum(['openai', 'ollama', 'compatible']),
  model: z.string().trim().min(1).max(100),
  key: z.string().trim().max(500).optional(),
});
export async function POST(request: Request) {
  try {
    await guard(request);
    if ((process.env.SESSION_SECRET?.length || 0) < 32)
      throw new Error(
        'Set SESSION_SECRET to at least 32 random characters in .env.local (or your hosting settings) and restart first. This encrypts your saved API key. You can also configure AI_API_KEY directly on the server.',
      );
    const settings = schema.parse(await readJson(request, 2000));
    const jar = await cookies();
    const previous = unseal<ModelSettings>(jar.get('relay_model')?.value || '');
    if (!settings.key && previous?.provider === settings.provider) settings.key = previous.key;
    if (settings.provider === 'compatible' && !process.env.AI_BASE_URL)
      throw new Error(
        'Set AI_BASE_URL on the server to your OpenAI-compatible endpoint, including /v1.',
      );
    jar.set('relay_model', seal(settings, 30 * 86400), { ...cookieOptions, maxAge: 30 * 86400 });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request) {
  try {
    await guard(request);
    (await cookies()).delete('relay_model');
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
