import { guard, readJson, errorResponse } from '@/lib/security';
import { databaseConfigured, dbQuery } from '@/lib/db';
import { workspaceWriteSchema } from '@/lib/workspace-data';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await guard();
    if (!databaseConfigured())
      return Response.json({ storage: 'browser', data: null, revision: 0 });
    const result = await dbQuery(
      "SELECT data, revision, updated_at FROM relay_workspace WHERE id='owner'",
    );
    if (!result.rows[0])
      throw new Error(
        'Relay’s workspace row is missing. Open Settings → Database and choose “Initialize or repair Relay tables”. Existing database rows will be preserved.',
      );
    return Response.json({ storage: 'postgresql', ...result.rows[0] });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PUT(request: Request) {
  try {
    await guard(request);
    if (!databaseConfigured()) throw new Error('Set DATABASE_URL to enable PostgreSQL saving.');
    const { data, revision } = workspaceWriteSchema.parse(await readJson(request, 3_500_000));
    const result = await dbQuery(
      "UPDATE relay_workspace SET data=$1::jsonb, revision=revision+1, updated_at=now() WHERE id='owner' AND revision=$2 RETURNING revision, updated_at",
      [JSON.stringify(data), revision],
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
