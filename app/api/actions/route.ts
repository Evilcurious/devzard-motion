import { cookies } from 'next/headers';
import { executeAction, validateAction, type WriteAction } from '@/lib/tools';
import { googleSession } from '@/lib/google';
import { guard, errorResponse, readJson, seal, unseal, cookieOptions } from '@/lib/security';
const used = new Map<string, number>();
export async function POST(request: Request) {
  try {
    await guard(request);
    const { token } = await readJson(request, 100000);
    if (typeof token !== 'string') throw new Error('Invalid approval.');
    const proposal = unseal<{ id: string; action: WriteAction; email: string }>(token);
    if (!proposal) throw new Error('This approval has expired. Ask the agent to prepare it again.');
    const session = await googleSession();
    if (!session || session.email !== proposal.email)
      throw new Error('Connect the same Google account used to prepare this action.');
    const jar = await cookies();
    const previous = unseal<string[]>(jar.get('relay_used_actions')?.value || '') || [];
    for (const [id, expiry] of used) if (expiry < Date.now()) used.delete(id);
    if (used.has(proposal.id) || previous.includes(proposal.id))
      throw new Error(
        'This action was already submitted. Check Gmail or Sheets before trying again.',
      );
    used.set(proposal.id, Date.now() + 20 * 60 * 1000);
    jar.set('relay_used_actions', seal([...previous.slice(-29), proposal.id], 3600), {
      ...cookieOptions,
      maxAge: 3600,
    });
    // Never automatically retry a side effect: a network failure may happen after Google accepts it.
    const result = await executeAction(validateAction(proposal.action.name, proposal.action.args));
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
