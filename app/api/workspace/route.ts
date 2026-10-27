import { guard, errorResponse, readJson } from '@/lib/security';
import { databaseConfigured, dbQuery } from '@/lib/db';
import { workspaceWriteSchema } from '@/lib/workspace-data';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const principal = await guard();
    if (!databaseConfigured()) {
      if (principal.role !== 'admin') throw new Error('User accounts require the shared Neon database.');
      return Response.json({ storage: 'browser', data: null, revision: 0 });
    }
    await dbQuery('INSERT INTO relay_workspace (id) VALUES ($1) ON CONFLICT DO NOTHING', [
      principal.id,
    ]);
    const result = await dbQuery(
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
    if (!databaseConfigured()) throw new Error('Set DATABASE_URL to enable PostgreSQL saving.');
    const { data, revision } = workspaceWriteSchema.parse(await readJson(request, 3_500_000));
    const result = await dbQuery(
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
