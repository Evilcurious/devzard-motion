import { googleClientConfig } from '@/lib/google-config';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { guard, errorResponse, cookieOptions } from '@/lib/security';
export async function POST(request: Request) {
  try {
    await guard(request);
    const config = await googleClientConfig();
    if (
      !config.clientId ||
      !config.clientSecret ||
      (process.env.SESSION_SECRET?.length || 0) < 32 ||
      !config.appURL
    )
      throw new Error(
        'Save your Google OAuth client ID and secret in Settings → Google APIs. Set APP_URL and SESSION_SECRET on the server first.',
      );
    const state = randomBytes(32).toString('hex');
    (await cookies()).set('relay_oauth_state', state, { ...cookieOptions, maxAge: 600 });
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: `${config.appURL}/api/google/callback`,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state,
      scope:
        'openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/spreadsheets',
    });
    return Response.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  } catch (error) {
    return errorResponse(error);
  }
}
