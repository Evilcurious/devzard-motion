import { authorized, errorResponse } from '@/lib/security';
import { googleSession } from '@/lib/google';
import { googleClientConfig } from '@/lib/google-config';
import { aiConfig } from '@/lib/ai';
import { databaseHealth } from '@/lib/db';
import { getGitHubInstallation } from '@/lib/github';
import { githubAppConfig } from '@/lib/github';
import { getVercelConnection, getVercelProjectSelection } from '@/lib/vercel';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const setupRequired =
      (!!(process.env.VERCEL || process.env.DATABASE_URL) && !process.env.APP_PASSWORD) ||
      (!!process.env.APP_PASSWORD && (process.env.SESSION_SECRET?.length || 0) < 32);
    if (!(await authorized())) return Response.json({ authenticated: false, setupRequired });
    const db = await databaseHealth();
    const common = {
      authenticated: true,
      passwordProtected: !!process.env.APP_PASSWORD,
      secureSettings: (process.env.SESSION_SECRET?.length || 0) >= 32,
      databaseConfigured: db.configured,
      databaseReady: db.ready,
      databaseError: db.error,
      databaseProvider: db.provider,
      databasePooled: db.pooled,
      databaseTLS: db.tls,
      deployment: process.env.VERCEL ? 'vercel' : 'self-hosted',
    };
    if (db.configured && !db.ready) return Response.json(common);
    try {
      const ai = await aiConfig();
      const google = await googleSession();
      const client = await googleClientConfig();
      const github = await getGitHubInstallation();
      const githubApp = await githubAppConfig();
      const vercel = await getVercelConnection();
      const vercelProject = vercel ? await getVercelProjectSelection() : null;
      return Response.json({
        ...common,
        provider: ai.provider,
        model: ai.model,
        baseURL: ai.baseURL,
        keySaved: !!ai.key,
        aiConfigured: ai.configured,
        googleConfigured: !!(
          client.clientId &&
          client.clientSecret &&
          common.secureSettings &&
          client.appURL
        ),
        googleEmail: google?.email || null,
        githubConfigured: !!(
          githubApp.appId &&
          githubApp.slug &&
          githubApp.privateKey &&
          githubApp.appURL &&
          common.secureSettings
        ),
        githubAccount: github?.account || null,
        vercelConnected: !!vercel,
        vercelAccount: vercel?.username || null,
        vercelProject: vercelProject?.name || null,
      });
    } catch (error) {
      return Response.json({ ...common, connectionError: (error as Error).message });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
