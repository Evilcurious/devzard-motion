import { guard, errorResponse, readJson } from '@/lib/security';
import { databaseHealth } from '@/lib/db';
import { accountDbQuery, accountDatabaseHealth } from '@/lib/tenant-database';
import { workspaceWriteSchema } from '@/lib/workspace-data';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const principal = await guard();
    const health =
      principal.role === 'user'
        ? await accountDatabaseHealth(principal.id)
        : await databaseHealth();
    if (!health.configured) {
      if (principal.role !== 'admin')
        throw new Error('Connect your PostgreSQL database before using this workspace.');
      return Response.json({ storage: 'browser', data: null, revision: 0 });
    }
    if (!health.ready)
      throw new Error('Your workspace database is not reachable. Check its status and reload.');
    await accountDbQuery('INSERT INTO relay_workspace (id) VALUES ($1) ON CONFLICT DO NOTHING', [
      principal.id,
    ]);
    const result = await accountDbQuery(
      'SELECT data, revision, updated_at FROM relay_workspace WHERE id=$1',
      [principal.id],
    );
    if (!result.rows[0])
      throw new Error(
        'This account’s workspace row is missing. Open Settings → Database and initialize Relay tables. Existing database rows will be preserved.',
      );
    return Response.json({ storage: 'postgresql', ...result.rows[0] });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PUT(request: Request) {
  try {
    const principal = await guard(request);
    const health =
      principal.role === 'user'
        ? await accountDatabaseHealth(principal.id)
        : await databaseHealth();
    if (!health.configured)
      throw new Error('Connect your PostgreSQL database before saving this workspace.');
    if (!health.ready)
      throw new Error('Your workspace database is not reachable. Your browser draft is preserved.');
    const { data, revision } = workspaceWriteSchema.parse(await readJson(request, 3_500_000));
    const result = await accountDbQuery(
      'UPDATE relay_workspace SET data=$1::jsonb, revision=revision+1, updated_at=now() WHERE id=$2 AND revision=$3 RETURNING revision, updated_at',
      [JSON.stringify(data), principal.id, revision],
    );
    if (!result.rowCount)
      return Response.json(
        {
          error:
            'Another tab or device changed this workspace. Download your unsaved backup, then reload to get the latest version. Nothing was overwritten.',
          conflict: true,
        },
        { status: 409 },
      );
    return Response.json(result.rows[0]);
  } catch (error) {
    return errorResponse(error);
  }
}
