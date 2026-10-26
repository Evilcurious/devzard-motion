import { removeConnection } from '@/lib/connection-store';
import { uninstallGitHubApp } from '@/lib/github';
import { errorResponse, guard } from '@/lib/security';

export async function POST(request: Request) {
  try {
    await guard(request);
    await uninstallGitHubApp();
    await removeConnection('github_repository');
    await removeConnection('github');
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
