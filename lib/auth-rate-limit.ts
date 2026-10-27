import { createHmac } from 'node:crypto';
import { dbQuery } from './db';

const ATTEMPT_LIMIT = 5;
const WINDOW_HOURS = 1;
function opaqueKey(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('Account sign-in is not configured securely. Contact the administrator.');
  return createHmac('sha256', secret).update(`relay-auth-rate:${value}`).digest('hex');
}
export function requestIp(request: Request) {
  return (
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  ).slice(0, 100);
}
export async function enforceAuthRateLimit(dimensions: string[]) {
  for (const dimension of [...new Set(dimensions.filter(Boolean))]) {
    const result = await dbQuery(
      `INSERT INTO relay_auth_rate_limits (key_hash, window_started_at, attempts, updated_at)
       VALUES ($1, now(), 1, now())
       ON CONFLICT (key_hash) DO UPDATE SET
         attempts = CASE
           WHEN relay_auth_rate_limits.window_started_at <= now() - ($2::int * interval '1 hour') THEN 1
           ELSE relay_auth_rate_limits.attempts + 1
         END,
         window_started_at = CASE
           WHEN relay_auth_rate_limits.window_started_at <= now() - ($2::int * interval '1 hour') THEN now()
           ELSE relay_auth_rate_limits.window_started_at
         END,
         updated_at = now()
       RETURNING attempts`,
      [opaqueKey(dimension), WINDOW_HOURS],
    );
    if (Number(result.rows[0]?.attempts) > ATTEMPT_LIMIT)
      throw Object.assign(new Error('Too many attempts. Try again in about an hour.'), {
        status: 429,
      });
  }
  await dbQuery(
    `DELETE FROM relay_auth_rate_limits WHERE updated_at < now() - interval '24 hours'`,
  ).catch(() => {});
}
