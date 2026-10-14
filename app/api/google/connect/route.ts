import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { guard, errorResponse, cookieOptions } from '@/lib/security';
export async function POST(request: Request) {
  try {
    await guard(request);
    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      (process.env.SESSION_SECRET?.length || 0) < 32 ||
      !process.env.APP_URL
    )
      throw new Error(
        'Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET and APP_URL to your server environment first. See Settings → Setup guide.',
      );
    const state = randomBytes(32).toString('hex');
    (await cookies()).set('relay_oauth_state', state, { ...cookieOptions, maxAge: 600 });
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: `${process.env.APP_URL}/api/google/callback`,
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
