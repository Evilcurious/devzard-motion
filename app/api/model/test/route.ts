import { requireAdmin, errorResponse } from '@/lib/security';
import { aiConfig } from '@/lib/ai';
import { providerError } from '@/lib/ai-errors';
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const config = await aiConfig();
    if (!config.configured) throw new Error('Configure a model before testing the connection.');
    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        ...(config.key ? { Authorization: `Bearer ${config.key}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        max_tokens: 8,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(providerError(response.status, config.baseURL));
    const body = await response.json();
    if (!body.choices?.[0]?.message)
      throw new Error('This endpoint did not return an OpenAI-compatible response.');
    return Response.json({ message: `Connected to ${config.model}.` });
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'TimeoutError'))
      return Response.json(
        {
          error:
            'Could not reach the model. Check the endpoint and make sure the model is running.',
        },
        { status: 502 },
      );
    return errorResponse(error);
  }
}
