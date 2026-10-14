import { readConnection } from './connection-store';
export type GoogleClientSettings = { clientId: string; clientSecret: string };
export async function googleClientConfig() {
  const saved = await readConnection<GoogleClientSettings>('google_client');
  return {
    clientId: saved?.clientId || process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: saved?.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '',
    appURL: (process.env.APP_URL || '').replace(/\/$/, ''),
  };
}
