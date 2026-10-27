import { requireAdmin, errorResponse } from '@/lib/security';
import { databaseConfigured, databaseHealth, dbQuery } from '@/lib/db';
import { schemaSql } from '@/lib/schema-sql';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    return Response.json(await databaseHealth(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// Hosted Neon connections cannot run the local migration CLI. This endpoint
// runs only the fixed, idempotent Relay schema after workspace authentication;
// CREATE IF NOT EXISTS and INSERT ... ON CONFLICT preserve existing data.
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    if (!databaseConfigured()) {
      return Response.json(
        { error: 'DATABASE_URL is not configured for this deployment.' },
        { status: 400 },
      );
    }
    await dbQuery(schemaSql);
    const health = await databaseHealth();
    if (!health.ready) throw new Error(health.error || 'Relay database tables are not ready.');
    return Response.json(
      { ok: true, ...health },
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
