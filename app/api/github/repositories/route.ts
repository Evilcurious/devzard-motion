import { z } from 'zod';
import { guard, errorResponse, readJson } from '@/lib/security';
import { removeConnection, saveConnection } from '@/lib/connection-store';
import {
  getGitHubInstallation,
  getSelectedGitHubRepository,
  listGitHubRepositories,
  selectGitHubRepository,
} from '@/lib/github';

export async function GET() {
  try {
    await guard();
    const installation = await getGitHubInstallation();
    const repositories = installation ? await listGitHubRepositories() : [];
    let selection = installation ? await getSelectedGitHubRepository() : null;
    if (selection && !repositories.some((repository) => repository.id === selection?.id)) {
      await removeConnection('github_repository');
      selection = null;
    }
    // A single available repository is unambiguous, so attach it automatically.
    if (installation && !selection && repositories.length === 1) {
      selection = repositories[0];
      await saveConnection('github_repository', selection);
    }
    return Response.json({
      connected: !!installation,
      account: installation?.account || null,
      installationId: installation?.installationId || null,
      repositories,
      selection,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await guard(request);
    const { repositoryId } = z
      .object({ repositoryId: z.number().int().positive().safe() })
      .parse(await readJson(request, 2000));
    const repository = await selectGitHubRepository(repositoryId);
    await saveConnection('github_repository', repository);
    return Response.json({ selection: repository });
  } catch (error) {
    return errorResponse(error);
  }
}
