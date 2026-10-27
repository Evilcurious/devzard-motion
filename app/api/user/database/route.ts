import { z } from 'zod';
import { guard, errorResponse, readJson } from '@/lib/security';
import {
  accountDatabaseHealth,
  configureAccountDatabase,
  replaceAccountDatabase,
} from '@/lib/tenant-database';

const inputSchema = z.object({
  connectionString: z.string().trim().min(20).max(2000),
  replace: z.boolean().optional(),
});
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const principal = await guard();
    if (principal.role !== 'user' || principal.plan !== 'free')
      throw new Error('Personal database setup is only available on Free accounts.');
    return Response.json(await accountDatabaseHealth(principal.id), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const principal = await guard(request);
    if (principal.role !== 'user' || principal.plan !== 'free')
      throw new Error('Personal database setup is only available on Free accounts.');
    const input = inputSchema.parse(await readJson(request, 3000));
    if (input.replace) await replaceAccountDatabase(principal.id, input.connectionString);
    else await configureAccountDatabase(principal.id, input.connectionString);
    return Response.json(
      { ok: true, configured: true, ready: true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
