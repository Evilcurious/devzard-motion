import { googleClientConfig } from '@/lib/google-config';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { guard, errorResponse, cookieOptions, seal } from '@/lib/security';
export async function POST(request: Request) {
  try {
    const principal = await guard(request);
    const config = await googleClientConfig();
    if (
      !config.clientId ||
      !config.clientSecret ||
      (process.env.SESSION_SECRET?.length || 0) < 32 ||
      !config.appURL
    )
      throw new Error(
        'Google sign-in is not configured for this deployment. The deployment owner must set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL, and a stable SESSION_SECRET in the server or Vercel environment, then redeploy. Enable the Gmail API and Google Sheets API in the same Google Cloud project.',
      );
    const state = randomBytes(32).toString('hex');
    (await cookies()).set('relay_oauth_state', seal({ state, accountId: principal.id }, 600), {
      ...cookieOptions,
      maxAge: 600,
    });
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
