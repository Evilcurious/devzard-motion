import { cookies } from 'next/headers';
import { cookieOptions, seal, unseal } from '@/lib/security';
import { googleClientConfig } from '@/lib/google-config';
import { findOrCreateGoogleUser } from '@/lib/accounts';
import { enforceAuthRateLimit, requestIp } from '@/lib/auth-rate-limit';
import { ensureAccountSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';
function finishRedirect(
  request: Request,
  error?: string,
  base = process.env.APP_URL || new URL(request.url).origin,
) {
  const destination = new URL('/', base);
  if (error) destination.searchParams.set('auth_error', 'google');
  else destination.searchParams.set('auth_success', 'google');
  return Response.redirect(destination);
}
export async function GET(request: Request) {
  const jar = await cookies();
  const stateToken = jar.get('relay_google_auth_state')?.value || '';
  jar.delete('relay_google_auth_state');
  try {
    await ensureAccountSchema();
    await enforceAuthRateLimit([`ip:${requestIp(request)}`]);
    const params = new URL(request.url).searchParams;
    const code = params.get('code') || '';
    const suppliedState = params.get('state') || '';
    const state = unseal<{ state: string }>(stateToken);
    if (!state || !suppliedState || state.state !== suppliedState || !code)
      throw new Error('Google sign-in could not be verified.');
    const config = await googleClientConfig();
    if (!config.clientId || !config.clientSecret)
      throw new Error('Google sign-in is not configured.');
    const baseURL = config.appURL || new URL(request.url).origin;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: `${baseURL}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokens.access_token !== 'string')
      throw new Error('Google sign-in failed.');
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
    const profile = await profileResponse.json();
    if (
      !profileResponse.ok ||
      profile.email_verified !== true ||
      typeof profile.email !== 'string' ||
      typeof profile.sub !== 'string'
    )
      throw new Error('Google did not verify the email address.');
    await enforceAuthRateLimit([`email:${profile.email}`]);
    const user = await findOrCreateGoogleUser(profile.email, profile.sub);
    await enforceAuthRateLimit([`account:${user.id}`]);
    jar.set('relay_auth', seal({ userId: user.id }, 30 * 86400), {
      ...cookieOptions,
      maxAge: 30 * 86400,
    });
    return finishRedirect(request, undefined, baseURL);
  } catch {
    return finishRedirect(request, 'google');
  }
}
