'use client';
import { databaseLabel } from '@/lib/database-label';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Database,
  Github,
  KeyRound,
  LoaderCircle,
  Palette,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import { api } from '@/lib/client-api';
import { themes, type Theme } from '@/lib/themes';
import { fontOptions, type Appearance, type FontFormat } from '@/lib/appearance';
import type { Status } from '@/lib/client-types';
import { AppIcon } from './ui';
export function AppearanceSettings({
  theme,
  onChange,
  database,
  storageName,
  appearance,
  onAppearanceChange,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
  database: boolean;
  storageName: string;
  appearance: Appearance;
  onAppearanceChange: (appearance: Appearance) => void;
}) {
  const [fontError, setFontError] = useState('');
  return (
    <section>
      <div className="section-intro">
        <h2>Find your comfortable palette</h2>
        <p>Choose a balanced colour theme. Your selection carries across the whole workspace.</p>
      </div>
      <div className="theme-grid">
        {themes.map((item) => (
          <button
            key={item.id}
            className={`theme-card ${theme === item.id ? 'selected' : ''}`}
            aria-pressed={theme === item.id}
            onClick={() => onChange(item.id)}
          >
            <div
              className="theme-preview"
              style={
                {
                  '--preview-accent': item.color,
                  '--preview-background': item.background,
                  '--preview-surface': item.surface,
                  '--preview-ink': item.ink,
                } as React.CSSProperties
              }
            >
              <div className="theme-preview-sidebar">
                <i />
                <i />
                <i />
              </div>
              <div className="theme-preview-body">
                <i />
                <i />
                <span />
                <b />
              </div>
            </div>
            <span>
              {item.label}
              {theme === item.id && <Check size={16} />}
            </span>
          </button>
        ))}
      </div>
      <section className="appearance-controls" aria-label="Custom colors and typography">
        <div className="section-heading">
          <h2>Personalize your palette</h2>
        </div>
        <p className="muted-text">
          Pick any accent color. It updates buttons, highlights and the chat details.
        </p>
        <div className="appearance-control-row">
          <label className="color-picker-label" htmlFor="custom-accent-color">
            Accent color
            <input
              id="custom-accent-color"
              aria-label="Choose accent color"
              type="color"
              value={appearance.accentColor || themes.find((item) => item.id === theme)!.color}
              onChange={(event) =>
                onAppearanceChange({ ...appearance, accentColor: event.target.value })
              }
            />
            <span>{appearance.accentColor || 'Match selected theme'}</span>
          </label>
          <button
            className="button small"
            type="button"
            disabled={!appearance.accentColor}
            onClick={() => onAppearanceChange({ ...appearance, accentColor: null })}
          >
            Reset to theme color
          </button>
        </div>
        <label className="font-picker-label" htmlFor="relay-font">
          Workspace font
          <select
            id="relay-font"
            value={appearance.customFont ? 'custom' : appearance.fontId}
            onChange={(event) => {
              if (event.target.value !== 'custom')
                onAppearanceChange({
                  ...appearance,
                  fontId: event.target.value as Appearance['fontId'],
                });
            }}
          >
            {fontOptions.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
            {appearance.customFont && (
              <option value="custom">{appearance.customFont.name} (uploaded)</option>
            )}
          </select>
        </label>
        <label className="font-upload-label" htmlFor="custom-font-file">
          Upload your own font
          <input
            id="custom-font-file"
            aria-label="Upload a custom font"
            type="file"
            accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              setFontError('');
              if (file.size > 1_000_000) {
                setFontError('Choose a font file smaller than 1 MB.');
                return;
              }
              const format = file.name.split('.').pop()?.toLowerCase() as FontFormat | undefined;
              if (!format || !['woff2', 'woff', 'ttf', 'otf'].includes(format)) {
                setFontError('Supported font formats: WOFF2, WOFF, TTF and OTF.');
                return;
              }
              const bytes = new Uint8Array(await file.arrayBuffer());
              const signature = String.fromCharCode(...bytes.slice(0, 4));
              const valid =
                format === 'woff2'
                  ? signature === 'wOF2'
                  : format === 'woff'
                    ? signature === 'wOFF'
                    : format === 'otf'
                      ? signature === 'OTTO'
                      : signature === '\u0000\u0001\u0000\u0000';
              if (!valid) {
                setFontError(
                  'This file does not match its font extension. Choose a valid font file.',
                );
                return;
              }
              let binary = '';
              for (let offset = 0; offset < bytes.length; offset += 0x8000)
                binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
              onAppearanceChange({
                ...appearance,
                customFont: {
                  name: file.name.replace(/\.[^.]+$/, '').slice(0, 100),
                  format,
                  data: btoa(binary),
                },
              });
            }}
          />
          <span>WOFF2, WOFF, TTF or OTF · max 1 MB · stored with your workspace preferences</span>
        </label>
        {fontError && (
          <div className="error-box" role="alert">
            {fontError}
          </div>
        )}
        {appearance.customFont && (
          <button
            className="text-button danger-text"
            type="button"
            onClick={() => onAppearanceChange({ ...appearance, customFont: null })}
          >
            Remove uploaded font <span aria-hidden="true">×</span>
          </button>
        )}
      </section>
      <div className="subtle-note">
        <Palette size={15} />
        {database
          ? `Your theme, color and font settings save to ${storageName} with your workspace.`
          : 'Your theme, chosen accent and font are remembered in this browser. Connect Neon Postgres to share them between devices.'}
      </div>
    </section>
  );
}
export function StorageSettings({
  status,
  refresh,
  notify,
}: {
  status: Status;
  refresh: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function initializeTables() {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ provider: string | null; ready: boolean }>(
        '/api/database',
        undefined,
        'POST',
      );
      if (!result.ready)
        throw new Error('The database connection did not pass the readiness check.');
      await refresh();
      notify(
        `${result.provider === 'neon' ? 'Neon' : 'PostgreSQL'} connection succeeded. Relay tables are initialized; existing database rows were preserved. Download your browser draft before reloading.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-intro">
        <h2>A permanent home for your workspace</h2>
        <p>
          Store conversations, workflows, activity, preferences and encrypted credentials in
          {databaseLabel(status)}. No local database server is required when using Neon.
        </p>
      </div>
      <section className="settings-panel">
        <div className="panel-title">
          <Database size={18} />
          <h3>{databaseLabel(status)}</h3>
          <span className={`small-badge ${status.databaseReady ? 'green' : ''}`}>
            {status.databaseReady
              ? 'Connected'
              : status.databaseConfigured
                ? 'Needs attention'
                : 'Not configured'}
          </span>
        </div>
        <div className="settings-form">
          {status.databaseConfigured && (
            <div className="database-facts">
              <span>
                Provider{' '}
                <strong>
                  {status.databaseProvider ? databaseLabel(status) : 'Check connection string'}
                </strong>
              </span>
              <span>
                Endpoint{' '}
                <strong>
                  {status.databaseProvider === 'neon'
                    ? status.databasePooled
                      ? 'Pooled'
                      : 'Direct'
                    : 'Standard PostgreSQL'}
                </strong>
              </span>
              <span>
                Security{' '}
                <strong>
                  {status.databaseProvider === 'neon' || status.databaseTLS
                    ? 'Verified TLS required'
                    : 'Your connection settings'}
                </strong>
              </span>
            </div>
          )}
          <div className="storage-features">
            <p>
              <Check size={15} />
              Chat and document history survives browser changes
            </p>
            <p>
              <Check size={15} />
              API keys and Google tokens encrypted at rest
            </p>
            <p>
              <Check size={15} />
              One shared owner workspace, protected by your password
            </p>
            <p>
              <Check size={15} />
              Conflicting saves are rejected instead of overwriting history
            </p>
          </div>
          {(error || status.databaseError) && (
            <div className="error-box" role="alert">
              {error || status.databaseError}
            </div>
          )}
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                const result = await api<{ configured: boolean; ready: boolean; error?: string }>(
                  '/api/database',
                  undefined,
                  'GET',
                );
                await refresh();
                if (result.ready)
                  notify(`${databaseLabel(status)} is connected and all tables are ready.`);
                else
                  setError(
                    result.error ||
                      'Open Settings → Database and choose “Initialize or repair Relay tables” to run the safe hosted migration.',
                  );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <LoaderCircle size={15} className="spin" /> : <Database size={15} />}Check
            database connection
          </button>
          {status.databaseConfigured && !status.databaseReady && (
            <div className="database-migration-help">
              <p>
                If Neon is connected but Relay tables are missing, initialize them here. This
                migration only creates missing tables and preserves existing workspace data. Keep
                this page open; download any unsaved draft before reloading after migration.
              </p>
              <button className="button" disabled={busy} onClick={initializeTables}>
                {busy ? <LoaderCircle size={15} className="spin" /> : <Database size={15} />}
                Initialize or repair Relay tables
              </button>
            </div>
          )}
        </div>
      </section>
      <section className="settings-panel">
        <div className="panel-title">
          <ShieldCheck size={18} />
          <h3>Connect Neon from your laptop or hosting</h3>
        </div>
        <div className="settings-form">
          <ol className="setup-list">
            <li>
              Create a project in{' '}
              <a href="https://console.neon.tech" target="_blank" rel="noreferrer">
                Neon Console
              </a>
              . Click <strong>Connect</strong>, choose your database and enable connection pooling.
              Copy the complete PostgreSQL connection string.
            </li>
            <li>
              {status.deployment === 'vercel'
                ? 'On Vercel, set APP_PASSWORD and a stable SESSION_SECRET in the relay project’s Environment Variables. Do not run npm run setup on your computer.'
                : 'Run npm run setup to create missing security settings. Open .env.local to find your workspace password.'}
            </li>
            <li>
              {status.deployment === 'vercel'
                ? 'In Vercel → relay → Settings → Environment Variables, make sure DATABASE_URL is set for Production (and Preview if needed). Do not paste it into chat or the code repository.'
                : 'On your laptop, add the URL to .env.local. For Vercel, add it to the project’s Environment Variables:'}
              {status.deployment !== 'vercel' && (
                <pre className="config-example">
                  DATABASE_URL="paste-your-full-Neon-connection-string"
                </pre>
              )}{' '}
              Keep the actual database name from Neon (often <code>neondb</code>), not{' '}
              <code>relay</code> unless you created it. Copy plain text, with <code>&amp;</code>{' '}
              instead of HTML <code>&amp;amp;</code>.
            </li>
            <li>
              {status.deployment === 'vercel'
                ? 'After connecting Neon, use “Initialize or repair Relay tables” above. This hosted migration creates missing Relay tables without deleting existing data; no local command or restart is required.'
                : 'Run npm run db:migrate and npm run db:check. This creates Relay’s tables without deleting existing data.'}
            </li>
          </ol>
          <p className="muted-text">
            The first connection imports this browser’s history only if the database is empty.
            Existing database history takes priority. Changes save automatically; wait for “Saved to{' '}
            {databaseLabel(status)}” before closing the page. Reload other devices to fetch the
            latest history.
          </p>
          <div className="info-callout">
            <ShieldCheck size={18} />
            <div>
              <strong>Your app can run locally or on Vercel; saved data lives in Neon.</strong>
              <p>
                Neon requires internet access. Keep your DATABASE_URL private and preserve your
                existing SESSION_SECRET. Changing it makes saved credentials unreadable. Chats are
                stored as ordinary database records; use encrypted disks/backups if needed.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
type GoogleClientConfig = {
  clientId: string;
  appURL: string;
  secretSaved: boolean;
  redirectURI: string;
  configured: boolean;
};
export function GoogleSettings({
  status,
  refresh,
  notify,
}: {
  status: Status;
  refresh: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const [config, setConfig] = useState<GoogleClientConfig | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [appURL, setAppURL] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    const result = await api<GoogleClientConfig>('/api/google/config', undefined, 'GET');
    setConfig(result);
    setClientId(result.clientId || '');
    setAppURL(result.appURL || window.location.origin);
  };
  useEffect(() => {
    let cancelled = false;
    api<GoogleClientConfig>('/api/google/config', undefined, 'GET')
      .then((result) => {
        if (cancelled) return;
        setConfig(result);
        setClientId(result.clientId || '');
        setAppURL(result.appURL || window.location.origin);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function save() {
    setBusy(true);
    setError('');
    try {
      await api('/api/google/config', {
        clientId,
        clientSecret: clientSecret || undefined,
        appURL,
      });
      setClientSecret('');
      await load();
      await refresh();
      notify('Google OAuth settings saved securely.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removeConfig() {
    if (
      !window.confirm(
        'Remove the saved Google OAuth app credentials and Google account connection?',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api('/api/google/config', {}, 'DELETE');
      setClientSecret('');
      await load();
      await refresh();
      notify('Google OAuth app settings removed.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function connect() {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ url: string }>('/api/google/connect');
      window.location.assign(result.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function disconnect() {
    if (!window.confirm('Disconnect Gmail and Google Sheets from this Relay workspace?')) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/google/disconnect', {});
      await refresh();
      notify('Google disconnected from Relay. You can reconnect any time.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-panel integration-settings-panel">
      <div className="panel-title">
        <AppIcon type="email" />
        <h3>Google · Gmail and Sheets</h3>
        <span className={`small-badge ${status.googleEmail ? 'green' : ''}`}>
          {status.googleEmail
            ? 'Connected'
            : status.googleConfigured
              ? 'Ready to connect'
              : 'Setup needed'}
        </span>
      </div>
      <div className="settings-form">
        <p className="settings-help">
          Configure your Google OAuth web app here, then authorize the Gmail and Sheets connection.
          The client secret is write-only and never sent back to this page.
        </p>
        <label>
          Google OAuth Client ID
          <input
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            autoComplete="off"
          />
        </label>
        <label>
          Google OAuth Client Secret
          <input
            type="password"
            value={clientSecret}
            onChange={(event) => setClientSecret(event.target.value)}
            placeholder={
              config?.secretSaved
                ? 'Saved — leave blank to keep the current secret'
                : 'Paste the OAuth client secret'
            }
            autoComplete="new-password"
          />
        </label>
        <label>
          Relay site URL
          <input
            value={appURL}
            onChange={(event) => setAppURL(event.target.value)}
            placeholder="https://relay.example.com"
          />
          <span>Use the public site origin, with no trailing path.</span>
        </label>
        {(appURL || config?.redirectURI) && (
          <div className="oauth-redirect-uri">
            Authorized redirect URI:
            {config?.redirectURI || `${appURL.replace(/\/$/, '')}/api/google/callback`}
          </div>
        )}
        <div className="integration-setup-help">
          In Google Cloud, create a Web application OAuth client, enable the Gmail API and Google
          Sheets API, and add the redirect URI above to its Authorized redirect URIs.
        </div>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <div className="form-actions">
          <button
            className="button primary"
            onClick={() => void save()}
            disabled={busy || !clientId.trim() || !appURL.trim()}
          >
            {busy ? <LoaderCircle size={15} className="spin" /> : <KeyRound size={15} />} Save
            Google app settings
          </button>
          {config?.secretSaved && (
            <button className="button" onClick={() => void removeConfig()} disabled={busy}>
              Remove app settings
            </button>
          )}
        </div>
        {status.googleEmail && (
          <div className="connected-account">
            <Check size={14} /> Connected as {status.googleEmail}
          </div>
        )}
        <div className="form-actions">
          <button
            className="button"
            onClick={() => void connect()}
            disabled={busy || !status.googleConfigured}
          >
            <ArrowUpRight size={15} />{' '}
            {status.googleEmail ? 'Reconnect Google account' : 'Sign in with Google'}
          </button>
          {status.googleEmail && (
            <button className="button" onClick={() => void disconnect()} disabled={busy}>
              <Unplug size={15} /> Disconnect account
            </button>
          )}
        </div>
        <div className="subtle-note">
          <ShieldCheck size={14} />
          {status.databaseConfigured
            ? `OAuth app details and Google access tokens are encrypted in ${databaseLabel(status)}.`
            : 'OAuth app details and tokens use encrypted, HTTP-only cookies in this browser. Connect Neon to share them across browsers.'}
        </div>
      </div>
    </section>
  );
}

type GitHubAppConfig = {
  appId: string;
  slug: string;
  appURL: string;
  keySaved: boolean;
  configured: boolean;
  setupURL: string;
};
export function GitHubAppSettings({
  status,
  refresh,
  notify,
}: {
  status: Status;
  refresh: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const [config, setConfig] = useState<GitHubAppConfig | null>(null);
  const [appId, setAppId] = useState('');
  const [slug, setSlug] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [appURL, setAppURL] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    const result = await api<GitHubAppConfig>('/api/github/config', undefined, 'GET');
    setConfig(result);
    setAppId(result.appId || '');
    setSlug(result.slug || '');
    setAppURL(result.appURL || window.location.origin);
  };
  useEffect(() => {
    let cancelled = false;
    api<GitHubAppConfig>('/api/github/config', undefined, 'GET')
      .then((result) => {
        if (cancelled) return;
        setConfig(result);
        setAppId(result.appId || '');
        setSlug(result.slug || '');
        setAppURL(result.appURL || window.location.origin);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function save() {
    setBusy(true);
    setError('');
    try {
      await api('/api/github/config', {
        appId,
        slug,
        privateKey: privateKey || undefined,
        appURL,
      });
      setPrivateKey('');
      await load();
      await refresh();
      notify('GitHub App settings saved securely.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removeConfig() {
    if (!window.confirm('Remove the GitHub App credentials and disconnect its installation?'))
      return;
    setBusy(true);
    setError('');
    try {
      await api('/api/github/config', {}, 'DELETE');
      setPrivateKey('');
      await load();
      await refresh();
      notify('GitHub App settings removed.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-panel integration-settings-panel">
      <div className="panel-title">
        <Github size={18} />
        <h3>GitHub App</h3>
        <span className={`small-badge ${status.githubConfigured ? 'green' : ''}`}>
          {status.githubConfigured ? 'Ready' : 'Setup needed'}
        </span>
      </div>
      <div className="settings-form">
        <p className="settings-help">
          Enter your GitHub App credentials once. The private key is write-only and encrypted at
          rest; it is never returned to the browser.
        </p>
        <label>
          GitHub App ID
          <input
            value={appId}
            onChange={(event) => setAppId(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </label>
        <label>
          GitHub App URL slug
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="the-name-in-github.com/apps/…"
            autoComplete="off"
          />
        </label>
        <label>
          GitHub App private key (PEM)
          <textarea
            value={privateKey}
            onChange={(event) => setPrivateKey(event.target.value)}
            placeholder={
              config?.keySaved
                ? 'Saved — leave blank to keep the current private key'
                : '-----BEGIN RSA PRIVATE KEY-----'
            }
            autoComplete="new-password"
            rows={5}
            spellCheck={false}
          />
          {config?.keySaved && <span>Key saved. It is not displayed here.</span>}
        </label>
        <label>
          Relay site URL
          <input
            value={appURL}
            onChange={(event) => setAppURL(event.target.value)}
            placeholder="https://relay.example.com"
          />
          <span>Use the public site origin, with no trailing path.</span>
        </label>
        {(appURL || config?.setupURL) && (
          <div className="oauth-redirect-uri">
            GitHub App Setup URL:{' '}
            {config?.setupURL || `${appURL.replace(/\/$/, '')}/api/github/callback`}
          </div>
        )}
        <div className="integration-setup-help">
          In GitHub Developer Settings, create a GitHub App with Setup URL shown above and
          repository permissions Contents: Read and write, Metadata: Read. Save the App ID, URL
          slug, and generated private key here.
        </div>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <div className="form-actions">
          <button
            className="button primary"
            onClick={() => void save()}
            disabled={busy || !appId.trim() || !slug.trim() || !appURL.trim()}
          >
            {busy ? <LoaderCircle size={15} className="spin" /> : <KeyRound size={15} />} Save
            GitHub App settings
          </button>
          {config?.keySaved && (
            <button className="button" onClick={() => void removeConfig()} disabled={busy}>
              Remove app settings
            </button>
          )}
        </div>
        <div className="subtle-note">
          <ShieldCheck size={14} />
          {status.databaseConfigured
            ? `GitHub App credentials are encrypted in ${databaseLabel(status)}.`
            : 'GitHub App credentials use an encrypted, HTTP-only cookie in this browser. Connect Neon to share them across browsers.'}
        </div>
      </div>
    </section>
  );
}
