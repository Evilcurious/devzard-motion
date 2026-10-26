// Shared by the server and CLI. Never include the input URL in errors or public status.
export function postgresConfig(raw = process.env.DATABASE_URL) {
  if (!raw?.trim())
    throw configError(
      'Add your Neon Postgres connection string as DATABASE_URL in .env.local (or your hosting environment).',
    );
  if (raw.includes('mailto:') || raw.includes('&amp;') || raw.includes(']('))
    throw configError(
      'DATABASE_URL contains copied link/HTML formatting. Copy the plain connection string from Neon → Connect; use & instead of &amp;.',
    );
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw configError(
      'DATABASE_URL is not a valid PostgreSQL connection string. Copy it directly from Neon → Connect.',
    );
  }
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !url.hostname ||
    url.pathname.length < 2 ||
    url.hash
  )
    throw configError(
      'Use a PostgreSQL URL with a host and an existing database name. Keep the database name shown in Neon → Connect.',
    );
  const neon = url.hostname.endsWith('.neon.tech');
  if (neon && (!url.username || !url.password))
    throw configError(
      'The Neon connection string needs a role and password. Copy a new string from Neon → Connect.',
    );
  if (neon) {
    if (
      ['host', 'hostaddr', 'port', 'user', 'password', 'database'].some((key) =>
        url.searchParams.has(key),
      )
    )
      throw configError(
        'Use the plain Neon connection string without host or credential overrides in its query parameters.',
      );
    // Neon uses public, trusted TLS certificates. Never disable certificate verification.
    url.searchParams.set('sslmode', 'verify-full');
    url.searchParams.delete('ssl');
    url.searchParams.delete('uselibpqcompat');
  }
  const enableChannelBinding =
    neon || ['require', 'prefer'].includes(url.searchParams.get('channel_binding') || '');
  return {
    connectionString: url.toString(),
    enableChannelBinding,
    connectionTimeoutMillis: neon ? 15000 : 8000,
    provider: neon ? 'neon' : 'postgresql',
    verifyTLS: url.searchParams.get('sslmode') === 'verify-full',
    pooled: neon && url.hostname.split('.')[0].endsWith('-pooler'),
  };
}
function configError(message) {
  return Object.assign(new Error(message), { code: 'RELAY_DB_CONFIG' });
}
export function databaseErrorMessage(error) {
  const code = error?.code;
  if (code === 'RELAY_DB_CONFIG') return error.message;
  if (code === '28P01' || code === '28000')
    return 'Database sign-in failed. Copy a fresh connection string from Neon → Connect after resetting the role password, then restart Relay.';
  if (code === '3D000')
    return 'That database does not exist. Keep the actual database name from your connection string (often neondb); do not change it to relay unless you created relay.';
  if (code === '42P01')
    return 'Your database is reachable, but Relay tables need initialization. Open Settings → Database and choose “Initialize or repair Relay tables”. This hosted migration is safe and does not delete existing data. Download your browser draft before reloading.';
  return 'Database connection failed. Check DATABASE_URL, internet access, TLS and database permissions. Run npm run db:check for a safe connection check.';
}
