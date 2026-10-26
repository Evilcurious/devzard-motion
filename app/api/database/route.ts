import { guard, errorResponse } from '@/lib/security';
import { databaseHealth } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await guard();
    return Response.json(await databaseHealth());
  } catch (error) {
    return errorResponse(error);
  }
}
