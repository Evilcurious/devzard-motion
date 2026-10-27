import { googleClientConfig } from '@/lib/google-config';
import { cookies } from 'next/headers';
import { equal, guard, unseal } from '@/lib/security';
import { saveGoogle } from '@/lib/google';
export async function GET(request: Request) {
  const base = process.env.APP_URL || new URL(request.url).origin;
  try {
    const principal = await guard();
    const config = await googleClientConfig();
    const params = new URL(request.url).searchParams;
    const jar = await cookies();
    const statePayload = unseal<{ state: string; accountId: string }>(
      jar.get('relay_oauth_state')?.value || '',
    );
    jar.delete('relay_oauth_state');
    if (
      !statePayload ||
      statePayload.accountId !== principal.id ||
      !params.get('state') ||
      !equal(statePayload.state, params.get('state')!)
    )
      throw new Error('Authorization expired. Please try connecting again.');
    if (!params.get('code')) throw new Error('Google connection was cancelled.');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        code: params.get('code')!,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: `${base}/api/google/callback`,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error('Google authorization failed. Check your client settings.');
    const profile = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
      signal: AbortSignal.timeout(15000),
    });
    const user = await profile.json();
    if (!profile.ok || !user.email) throw new Error('Could not read your Google account.');
    await saveGoogle({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      email: user.email,
    });
    return Response.redirect(`${base}/?connected=google`);
  } catch (error) {
    return Response.redirect(
      `${base}/?connection_error=${encodeURIComponent(error instanceof Error ? error.message : 'Connection failed.')}`,
    );
  }
}
