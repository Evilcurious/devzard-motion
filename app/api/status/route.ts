import { getPrincipal, errorResponse } from '@/lib/security';
import { googleSession } from '@/lib/google';
import { googleClientConfig } from '@/lib/google-config';
import { aiConfig } from '@/lib/ai';
import { databaseHealth } from '@/lib/db';
import { getGitHubInstallation, githubAppConfig } from '@/lib/github';
import { getVercelConnection, getVercelProjectSelection } from '@/lib/vercel';
import { monthlyTokenUsage } from '@/lib/accounts';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const principal = await getPrincipal();
    const setupRequired =
      (!!(process.env.VERCEL || process.env.DATABASE_URL) && !process.env.APP_PASSWORD) ||
      (!!process.env.APP_PASSWORD && (process.env.SESSION_SECRET?.length || 0) < 32);
    if (!principal) return Response.json({ authenticated: false, setupRequired });
    const db = await databaseHealth();
    const secureSettings = (process.env.SESSION_SECRET?.length || 0) >= 32;
    const common = {
      authenticated: true,
      role: principal.role,
      accountId: principal.id,
      username: principal.username,
      providerMode: principal.role === 'user' ? principal.providerMode : null,
      allowedModels: principal.role === 'user' ? principal.allowedModels : [],
      monthlyTokenLimit: principal.role === 'user' ? principal.monthlyTokenLimit : null,
      passwordProtected: !!process.env.APP_PASSWORD,
      ...(principal.role === 'admin'
        ? {
            secureSettings,
            databaseError: db.error,
            databaseProvider: db.provider,
            databasePooled: db.pooled,
            databaseTLS: db.tls,
          }
        : {}),
      databaseConfigured: db.configured,
      databaseReady: db.ready,
      deployment: process.env.VERCEL ? 'vercel' : 'self-hosted',
    };
    if (db.configured && !db.ready) return Response.json(common);
    try {
      const [ai, google, client, github, githubApp, vercel] = await Promise.all([
        aiConfig(),
        googleSession(),
        googleClientConfig(),
        getGitHubInstallation(),
        githubAppConfig(),
        getVercelConnection(),
      ]);
      const vercelProject = vercel ? await getVercelProjectSelection() : null;
      const usedTokens = principal.role === 'user' ? await monthlyTokenUsage(principal.id) : null;
      return Response.json({
        ...common,
        ...(principal.role === 'admin'
          ? { provider: ai.provider, model: ai.model, baseURL: ai.baseURL, keySaved: !!ai.key }
          : { model: ai.model }),
        aiConfigured: ai.configured,
        googleConfigured: !!(
          client.clientId &&
          client.clientSecret &&
          secureSettings &&
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
        usedTokens,
        remainingTokens:
          principal.role === 'user'
            ? Math.max(0, principal.monthlyTokenLimit - (usedTokens || 0))
            : null,
      });
    } catch (error) {
      return Response.json({ ...common, connectionError: (error as Error).message });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
