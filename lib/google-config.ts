import { readConnection } from './connection-store';
export type GoogleClientSettings = { clientId: string; clientSecret: string; appURL?: string };
export async function googleClientConfig() {
  const saved = await readConnection<GoogleClientSettings>('google_client', 'owner');
  return {
    clientId: saved?.clientId || process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: saved?.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '',
    appURL: (saved?.appURL || process.env.APP_URL || '').replace(/\/$/, ''),
  };
}
