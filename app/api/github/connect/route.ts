import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { cookieOptions, errorResponse, guard, seal } from '@/lib/security';
import { githubAppConfig } from '@/lib/github';

export async function POST(request: Request) {
  try {
    const principal = await guard(request);
    const config = await githubAppConfig();
    if (!config.appId || !config.slug || !config.privateKey || !config.appURL)
      throw new Error(
        'GitHub is not configured on this Relay server yet. The owner must finish the one-time GitHub App setup; no access token is needed from you.',
      );
    if ((process.env.SESSION_SECRET?.length || 0) < 32)
      throw new Error('A stable SESSION_SECRET is required before connecting GitHub.');
    const state = randomBytes(32).toString('hex');
    (await cookies()).set('relay_github_state', seal({ state, accountId: principal.id }, 600), {
      ...cookieOptions,
      maxAge: 600,
    });
    const url = new URL(
      `https://github.com/apps/${encodeURIComponent(config.slug)}/installations/new`,
    );
    url.searchParams.set('state', state);
    return Response.json({ url: url.toString() });
  } catch (error) {
    return errorResponse(error);
  }
}
