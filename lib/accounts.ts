import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { dbQuery } from './db';
import { unpersistedUsageThisMonth } from './usage-memory';

export type ProviderMode = 'managed' | 'both';
export type AllowedAccountModel = {
  providerId: string;
  modelId: string;
  name: string;
};
export type UserPolicy = {
  id: string;
  username: string;
  email: string | null;
  plan: 'free' | 'premium';
  providerMode: ProviderMode;
  monthlyTokenLimit: number;
  allowedModels: AllowedAccountModel[];
  enabled: boolean;
};
const passwordPattern = /^[\x21-\x7e]{12,256}$/;
export function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username) || username === 'admin')
    throw new Error(
      'Use a username 3–32 characters long with letters, numbers, dots, dashes or underscores.',
    );
  return username;
}
export function hashAccountPassword(password: string) {
  if (!passwordPattern.test(password))
    throw new Error(
      'Choose a password of at least 12 characters using standard keyboard characters.',
    );
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
export function verifyAccountPassword(password: string, encoded: string) {
  try {
    const [scheme, saltHex, hashHex] = encoded.split('$');
    if (scheme !== 'scrypt' || !/^[\da-f]{32}$/i.test(saltHex) || !/^[\da-f]{128}$/i.test(hashHex))
      return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
export function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('Enter a valid email address.');
  return email;
}
export async function createFreeEmailAccount(emailValue: string, password: string) {
  const email = normalizeEmail(emailValue);
  const passwordHash = hashAccountPassword(password);
  const id = randomUUID();
  const username = `acct_${id.replaceAll('-', '').slice(0, 20)}`;
  try {
    const result = await dbQuery(
      `INSERT INTO relay_users
        (id, username, email, password_hash, provider_mode, monthly_token_limit, allowed_models, plan)
       VALUES ($1,$2,$3,$4,'both',0,'[]'::jsonb,'free')
       RETURNING id, username, email, plan, provider_mode, monthly_token_limit, allowed_models, enabled`,
      [id, username, email, passwordHash],
    );
    return mapUserRow(result.rows[0]);
  } catch (error) {
    if (/unique|duplicate/i.test((error as Error).message))
      throw new Error('An account with this email already exists. Sign in instead.');
    throw error;
  }
}
export async function findUserByEmail(emailValue: string) {
  const email = normalizeEmail(emailValue);
  const result = await dbQuery(
    `SELECT id, username, email, password_hash, enabled, plan
     FROM relay_users WHERE lower(email) = $1 LIMIT 1`,
    [email],
  );
  return result.rows[0]
    ? {
        id: String(result.rows[0].id),
        username: String(result.rows[0].username),
        email: result.rows[0].email ? String(result.rows[0].email) : null,
        passwordHash: result.rows[0].password_hash ? String(result.rows[0].password_hash) : null,
        enabled: result.rows[0].enabled === true,
        plan: result.rows[0].plan === 'free' ? ('free' as const) : ('premium' as const),
      }
    : null;
}
export async function findOrCreateGoogleUser(emailValue: string, subject: string) {
  const email = normalizeEmail(emailValue);
  if (!subject || subject.length > 255) throw new Error('Google sign-in could not be verified.');
  const existing = await dbQuery(
    `SELECT id, username, email, google_subject, enabled
     FROM relay_users WHERE lower(email) = $1 OR google_subject = $2 LIMIT 1`,
    [email, subject],
  );
  const row = existing.rows[0];
  if (row) {
    if (String(row.email || '').toLowerCase() !== email)
      throw new Error('This Google account is linked to a different Relay email.');
    if (row.google_subject && row.google_subject !== subject)
      throw new Error('This email is already linked to another Google account.');
    await dbQuery(
      `UPDATE relay_users SET google_subject=$2, updated_at=now() WHERE id=$1 AND google_subject IS NULL`,
      [row.id, subject],
    );
    if (row.enabled === false)
      throw new Error('This account is disabled. Contact the administrator.');
    return { id: String(row.id), username: String(row.username), email };
  }
  const id = randomUUID();
  const username = `acct_${id.replaceAll('-', '').slice(0, 20)}`;
  try {
    await dbQuery(
      `INSERT INTO relay_users
        (id, username, email, password_hash, google_subject, provider_mode, monthly_token_limit, allowed_models, plan)
       VALUES ($1,$2,$3,NULL,$4,'both',0,'[]'::jsonb,'free')`,
      [id, username, email, subject],
    );
    return { id, username, email };
  } catch (error) {
    if (/unique|duplicate/i.test((error as Error).message))
      throw new Error('An account with this email already exists. Sign in instead.');
    throw error;
  }
}
export async function setAccountPlanByEmail(
  emailValue: string,
  plan: 'free' | 'premium',
  monthlyTokenLimit = 0,
  allowedModels: AllowedAccountModel[] = [],
) {
  const email = normalizeEmail(emailValue);
  const result = await dbQuery(
    `UPDATE relay_users SET plan=$2, provider_mode=$3, monthly_token_limit=$4,
       allowed_models=$5::jsonb, updated_at=now()
     WHERE lower(email)=$1 RETURNING id`,
    [
      email,
      plan,
      plan === 'premium' ? 'managed' : 'both',
      monthlyTokenLimit,
      JSON.stringify(allowedModels),
    ],
  );
  return (result.rowCount || 0) > 0;
}
export async function createUserInvite(input: {
  providerMode: ProviderMode;
  monthlyTokenLimit: number;
  allowedModels: AllowedAccountModel[];
}) {
  const token = randomBytes(32).toString('base64url');
  const policy = {
    providerMode: input.providerMode,
    monthlyTokenLimit: input.monthlyTokenLimit,
    allowedModels: input.allowedModels,
  };
  await dbQuery(
    `INSERT INTO relay_invites (token_hash, policy, expires_at)
     VALUES ($1, $2::jsonb, now() + interval '24 hours')`,
    [hashInviteToken(token), JSON.stringify(policy)],
  );
  return { token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() };
}
export async function inspectUserInvite(token: string) {
  const result = await dbQuery(
    `SELECT policy, expires_at FROM relay_invites
     WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()`,
    [hashInviteToken(token)],
  );
  const row = result.rows[0];
  return row
    ? {
        valid: true,
        expiresAt: new Date(row.expires_at).toISOString(),
        providerMode: row.policy.providerMode as ProviderMode,
      }
    : { valid: false, expiresAt: null, providerMode: null };
}
export async function redeemUserInvite(token: string, usernameValue: string, password: string) {
  const username = normalizeUsername(usernameValue);
  const passwordHash = hashAccountPassword(password);
  const id = randomUUID();
  try {
    const result = await dbQuery(
      `WITH consumed AS (
         UPDATE relay_invites SET consumed_at = now()
         WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
         RETURNING policy
       )
       INSERT INTO relay_users
         (id, username, password_hash, provider_mode, monthly_token_limit, allowed_models)
       SELECT $2, $3, $4, policy->>'providerMode', (policy->>'monthlyTokenLimit')::bigint,
              COALESCE(policy->'allowedModels', '[]'::jsonb)
       FROM consumed
       RETURNING id, username, provider_mode, monthly_token_limit, allowed_models, enabled`,
      [hashInviteToken(token), id, username, passwordHash],
    );
    if (!result.rows[0])
      throw new Error(
        'This setup link has expired or has already been used. Ask the administrator for a new one.',
      );
    return mapUserRow(result.rows[0]);
  } catch (error) {
    const message = (error as Error).message;
    if (/unique|duplicate/i.test(message))
      throw new Error('That username is already taken. Choose another.');
    throw error;
  }
}
function mapUserRow(row: Record<string, unknown>): UserPolicy {
  return {
    id: String(row.id),
    username: String(row.username),
    email: row.email ? String(row.email) : null,
    plan: row.plan === 'free' ? 'free' : 'premium',
    providerMode: row.provider_mode === 'both' ? 'both' : 'managed',
    monthlyTokenLimit: Number(row.monthly_token_limit) || 0,
    allowedModels: Array.isArray(row.allowed_models) ? row.allowed_models : [],
    enabled: row.enabled !== false,
  };
}
export async function findUserByUsername(usernameValue: string) {
  const username = usernameValue.trim().toLowerCase();
  const result = await dbQuery(
    `SELECT id, username, password_hash, enabled FROM relay_users WHERE username = $1`,
    [username],
  );
  const row = result.rows[0];
  return row
    ? {
        id: String(row.id),
        username: String(row.username),
        passwordHash: String(row.password_hash),
        enabled: row.enabled === true,
      }
    : null;
}
export async function getUserPolicy(id: string): Promise<UserPolicy | null> {
  const result = await dbQuery(
    `SELECT id, username, email, plan, provider_mode, monthly_token_limit, allowed_models, enabled
     FROM relay_users WHERE id = $1`,
    [id],
  );
  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}
export async function listUserAccounts() {
  const result = await dbQuery(
    `SELECT u.id, u.username, u.email, u.plan, u.provider_mode, u.monthly_token_limit, u.allowed_models,
       u.enabled, u.created_at,
       COALESCE(sum(COALESCE(a.input_tokens, 0) + COALESCE(a.output_tokens, 0))
         FILTER (WHERE a.created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'), 0) AS used_tokens
     FROM relay_users u LEFT JOIN relay_analytics a ON a.account_id = u.id
     GROUP BY u.id ORDER BY u.created_at DESC`,
  );
  return result.rows.map((row) => ({
    ...mapUserRow(row),
    createdAt: new Date(row.created_at).toISOString(),
    usedTokens: (Number(row.used_tokens) || 0) + unpersistedUsageThisMonth(String(row.id)),
  }));
}
export async function setUserEnabled(id: string, enabled: boolean) {
  const result = await dbQuery(
    `UPDATE relay_users SET enabled = $2, updated_at = now() WHERE id = $1 RETURNING id`,
    [id, enabled],
  );
  return (result.rowCount || 0) > 0;
}
export async function monthlyTokenUsage(accountId: string) {
  const result = await dbQuery(
    `SELECT COALESCE(sum(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0) AS used_tokens
     FROM relay_analytics
     WHERE account_id = $1
       AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
    [accountId],
  );
  return (Number(result.rows[0]?.used_tokens) || 0) + unpersistedUsageThisMonth(accountId);
}
