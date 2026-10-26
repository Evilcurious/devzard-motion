import { z } from 'zod';
import { guard, errorResponse, readJson } from '@/lib/security';
import { saveConnection } from '@/lib/connection-store';
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
    const [repositories, selection] = installation
      ? await Promise.all([listGitHubRepositories(), getSelectedGitHubRepository()])
      : [[], null];
    return Response.json({
      connected: !!installation,
      account: installation?.account || null,
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
