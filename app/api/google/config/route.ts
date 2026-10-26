import { z } from 'zod';
import { guard, readJson, errorResponse } from '@/lib/security';
import { readConnection, saveConnection, removeConnection } from '@/lib/connection-store';
import { googleClientConfig, type GoogleClientSettings } from '@/lib/google-config';
const schema = z.object({
  clientId: z.string().trim().min(1).max(300),
  clientSecret: z.string().trim().max(500).optional(),
});
export async function GET() {
  try {
    await guard();
    const config = await googleClientConfig();
    return Response.json({
      clientId: config.clientId,
      secretSaved: !!config.clientSecret,
      redirectURI: config.appURL ? `${config.appURL}/api/google/callback` : '',
      configured: !!(config.clientId && config.clientSecret && config.appURL),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    await guard(request);
    const input = schema.parse(await readJson(request, 3000));
    const previous = await readConnection<GoogleClientSettings>('google_client');
    const config = await googleClientConfig();
    const clientSecret =
      input.clientSecret ||
      (input.clientId === config.clientId ? previous?.clientSecret || config.clientSecret : '');
    if (!clientSecret) throw new Error('Enter the OAuth client secret for this client ID.');
    await saveConnection('google_client', { clientId: input.clientId, clientSecret });
    // A changed client invalidates the existing grant; never refresh a grant with another client.
    if (input.clientId !== config.clientId) await removeConnection('google');
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request) {
  try {
    await guard(request);
    await removeConnection('google_client');
    await removeConnection('google');
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
