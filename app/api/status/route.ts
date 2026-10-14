import { authorized } from '@/lib/security';
import { googleSession } from '@/lib/google';
import { aiConfig } from '@/lib/ai';
export const dynamic = 'force-dynamic';
export async function GET() {
  const ok = await authorized();
  const setupRequired =
    (!!process.env.VERCEL && !process.env.APP_PASSWORD) ||
    (!!process.env.APP_PASSWORD && (process.env.SESSION_SECRET?.length || 0) < 32);
  if (!ok) return Response.json({ authenticated: false, setupRequired });
  const ai = await aiConfig();
  const google = await googleSession();
  return Response.json({
    authenticated: true,
    passwordProtected: !!process.env.APP_PASSWORD,
    provider: ai.provider,
    model: ai.model,
    aiConfigured: ai.configured,
    googleConfigured: !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      (process.env.SESSION_SECRET?.length || 0) >= 32 &&
      process.env.APP_URL
    ),
    googleEmail: google?.email || null,
    deployment: process.env.VERCEL ? 'vercel' : 'self-hosted',
  });
}
