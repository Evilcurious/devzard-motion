import { guard, errorResponse } from '@/lib/security';
import { databaseConfigured, databaseHealth } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await guard();
    return Response.json(await databaseHealth());
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    await guard(request);
    if (!databaseConfigured()) throw new Error('Set DATABASE_URL before creating the tables.');
    await ensureSchema();
    return Response.json(await databaseHealth());
  } catch (error) {
    return errorResponse(error);
  }
}
