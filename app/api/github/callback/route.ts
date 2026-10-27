import { cookies } from 'next/headers';
import { removeConnection, saveConnection } from '@/lib/connection-store';
import {
  getGitHubInstallationDetails,
  getGitHubInstallationToken,
  githubAppConfig,
} from '@/lib/github';
import { equal, guard, unseal } from '@/lib/security';

export async function GET(request: Request) {
  let base = new URL(request.url).origin;
  try {
    const config = await githubAppConfig();
    base = config.appURL || base;
    const principal = await guard();
    const params = new URL(request.url).searchParams;
    const jar = await cookies();
    const statePayload = unseal<{ state: string; accountId: string }>(
      jar.get('relay_github_state')?.value || '',
    );
    jar.delete('relay_github_state');
    const actual = params.get('state');
    if (
      !statePayload ||
      statePayload.accountId !== principal.id ||
      !actual ||
      !equal(statePayload.state, actual)
    )
      throw new Error('GitHub authorization expired. Please try connecting again.');
    const rawId = params.get('installation_id');
    if (!rawId || !/^\d{1,20}$/.test(rawId))
      throw new Error('GitHub did not return a valid app installation.');
    const installation = await getGitHubInstallationDetails(Number(rawId));
    await getGitHubInstallationToken(installation);
    await saveConnection('github', installation);
    await removeConnection('github_repository');
    return Response.redirect(`${base}/?connected=github`);
  } catch (error) {
    return Response.redirect(
      `${base}/?connection_error=${encodeURIComponent(
        error instanceof Error ? error.message : 'GitHub connection failed.',
      )}`,
    );
  }
}
