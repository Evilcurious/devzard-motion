import { readConnection, saveConnection } from './connection-store';
import { googleClientConfig } from './google-config';
export type GoogleSession = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  email: string;
};
export async function googleSession() {
  return readConnection<GoogleSession>('google');
}
export async function saveGoogle(session: GoogleSession) {
  await saveConnection('google', session);
}
export async function googleFetch(path: string, init: RequestInit = {}) {
  let session = await googleSession();
  if (!session) throw new Error('Connect your Google account in Connections first.');
  if (session.expires_at < Date.now() + 60_000) {
    if (!session.refresh_token) throw new Error('Google session expired. Reconnect your account.');
    const config = await googleClientConfig();
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: session.refresh_token,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const token = await response.json();
    if (!response.ok) throw new Error('Google authorization expired. Reconnect your account.');
    session = {
      ...session,
      access_token: token.access_token,
      expires_at: Date.now() + token.expires_in * 1000,
    };
    await saveGoogle(session);
  }
  const response = await fetch(`https://${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
      Authorization: `Bearer ${session.access_token}`,
    },
    signal: AbortSignal.timeout(25000),
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(`Google: ${body.error?.message || 'Request failed. Check permissions.'}`);
  return body;
}
