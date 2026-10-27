import { databaseConfigured } from '@/lib/db';
import { accountDbQuery } from '@/lib/tenant-database';
import { cookies } from 'next/headers';
import { executeAction, validateAction, type WriteAction } from '@/lib/tools';
import { googleSession } from '@/lib/google';
import {
  getGitHubInstallation,
  getSelectedGitHubRepository,
  pushGitHubFiles,
  type GitHubSelection,
} from '@/lib/github';
import { guard, errorResponse, readJson, seal, unseal, cookieOptions } from '@/lib/security';
const used = new Map<string, number>();
type Approval = {
  id: string;
  accountId: string;
  action: WriteAction;
  email?: string;
  installationId?: number;
  repository?: GitHubSelection;
};
export async function POST(request: Request) {
  try {
    const principal = await guard(request);
    const { token } = await readJson(request, 1_100_000);
    if (typeof token !== 'string' || token.length > 1_000_000) throw new Error('Invalid approval.');
    const proposal = unseal<Approval>(token);
    if (!proposal) throw new Error('This approval has expired. Ask the agent to prepare it again.');
    if (proposal.accountId !== principal.id)
      throw new Error('This approval belongs to another account.');
    const action = validateAction(proposal.action.name, proposal.action.args);
    let account: string;
    if (action.name === 'github_push_files') {
      const installation = await getGitHubInstallation();
      const selected = await getSelectedGitHubRepository();
      if (
        !installation ||
        installation.installationId !== proposal.installationId ||
        !proposal.repository ||
        !selected ||
        selected.id !== proposal.repository.id
      )
        throw new Error(
          'The connected GitHub account or selected repository changed. Prepare the code proposal again.',
        );
      account = `github:${installation.installationId}`;
    } else {
      const session = await googleSession();
      if (!session || session.email !== proposal.email)
        throw new Error('Connect the same Google account used to prepare this action.');
      account = session.email;
    }
    const jar = await cookies();
    const previous = unseal<string[]>(jar.get('relay_used_actions')?.value || '') || [];
    for (const [id, expiry] of used) if (expiry < Date.now()) used.delete(id);
    if (used.has(proposal.id) || previous.includes(proposal.id))
      throw new Error(
        'This action was already submitted. Check the destination before trying again.',
      );
    if (databaseConfigured()) {
      const claim = await accountDbQuery(
        'INSERT INTO relay_action_claims (id, account) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
        [proposal.id, account],
      );
      if (!claim.rowCount)
        throw new Error(
          'This action was already submitted. Check the destination before trying again.',
        );
    }
    used.set(proposal.id, Date.now() + 20 * 60 * 1000);
    jar.set('relay_used_actions', seal([...previous.slice(-29), proposal.id], 3600), {
      ...cookieOptions,
      maxAge: 3600,
    });
    // Never automatically retry an external side effect if its response is uncertain.
    const result =
      action.name === 'github_push_files'
        ? proposal.repository
          ? await pushGitHubFiles(proposal.repository, action.args, proposal.id)
          : (() => {
              throw new Error('The selected GitHub repository was not included in this approval.');
            })()
        : await executeAction(action);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
