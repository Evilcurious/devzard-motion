import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { cookieOptions, seal } from '@/lib/security';
import { googleClientConfig } from '@/lib/google-config';
import { ensureAccountSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    if ((process.env.SESSION_SECRET?.length || 0) < 32)
      throw new Error('Google sign-in is not configured securely. Contact the administrator.');
    const config = await googleClientConfig();
    if (!config.clientId || !config.clientSecret)
      throw new Error('Google sign-up is not configured yet. Contact the administrator.');
    await ensureAccountSchema();
    const baseURL = config.appURL || new URL(request.url).origin;
    const redirectURI = `${baseURL}/api/auth/google/callback`;
    const state = randomBytes(32).toString('base64url');
    (await cookies()).set('relay_google_auth_state', seal({ state }, 600), {
      ...cookieOptions,
      maxAge: 600,
    });
    const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorize.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectURI,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    }).toString();
    return Response.redirect(authorize);
  } catch {
    return Response.redirect(new URL('/?auth_error=google', request.url));
  }
}
