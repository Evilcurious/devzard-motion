import { readConnection } from './connection-store';
export type GoogleClientSettings = { clientId: string; clientSecret: string };
export async function googleClientConfig() {
  const saved = await readConnection<GoogleClientSettings>('google_client');
  const environmentConfigured = !!(
    process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET
  );
  return {
    clientId: environmentConfigured ? process.env.GOOGLE_CLIENT_ID || '' : saved?.clientId || '',
    clientSecret: environmentConfigured
      ? process.env.GOOGLE_CLIENT_SECRET || ''
      : saved?.clientSecret || '',
    appURL: (process.env.APP_URL || '').replace(/\/$/, ''),
  };
}
