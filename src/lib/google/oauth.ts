import {
  GOOGLE_SCOPES,
  getGoogleConfig,
  googleClientSecret,
  googleTokens,
  setGoogleTokens,
  type GoogleConfig,
  type GoogleTokens,
} from "../settings";

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";

export function redirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI || `${appUrl()}/api/google/oauth/callback`;
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function authUrl(state = "connect"): string {
  const cfg = { clientId: process.env.GOOGLE_CLIENT_ID || "" } as GoogleConfig;
  const clientId = cfg.clientId;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const cfg = await getGoogleConfig();
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: googleClientSecret(cfg),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
  const existing = googleTokens(cfg);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || existing?.refresh_token || "",
    expires_at: Date.now() + data.expires_in * 1000 - 60_000,
    scope: data.scope,
  };
}

export async function refresh(cfg: GoogleConfig): Promise<string> {
  const tokens = googleTokens(cfg);
  if (!tokens?.refresh_token) throw new Error("Google account not connected (no refresh token)");
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: googleClientSecret(cfg),
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google refresh failed: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { access_token: string; expires_in: number; scope?: string };
  await setGoogleTokens({
    ...tokens,
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000 - 60_000,
    scope: data.scope || tokens.scope,
  });
  return data.access_token;
}

/** Always returns a usable access token, refreshing when needed. */
export async function accessToken(): Promise<string> {
  const cfg = await getGoogleConfig();
  if (!cfg.clientId || !googleClientSecret(cfg)) throw new Error("Google OAuth client not configured");
  const tokens = googleTokens(cfg);
  if (!tokens) throw new Error("Google account not connected");
  if (tokens.expires_at > Date.now() + 30_000) return tokens.access_token;
  return refresh(cfg);
}

export async function googleFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = await accessToken();
  const res = await fetch(`https://www.googleapis.com${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` },
  });
  if (res.status === 401 && retry) {
    const next = await refresh(await getGoogleConfig());
    return fetch(`https://www.googleapis.com${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), authorization: `Bearer ${next}` },
    });
  }
  return res;
}

export async function googleJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await googleFetch(path, init);
  if (!res.ok) throw new Error(`Google API ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return (await res.json()) as T;
}

export async function googleProfile(): Promise<{ email: string; name: string } | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { authorization: `Bearer ${await accessToken()}` },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { email?: string; name?: string };
    return { email: d.email ?? "", name: d.name ?? "" };
  } catch {
    return null;
  }
}
