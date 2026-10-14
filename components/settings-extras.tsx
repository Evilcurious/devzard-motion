'use client';
import { databaseLabel } from '@/lib/database-label';
import { useEffect, useState } from 'react';
import {
  Check,
  Database,
  KeyRound,
  LoaderCircle,
  Palette,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import { api } from '@/lib/client-api';
import { themes, type Theme } from '@/lib/themes';
import type { Status } from '@/lib/client-types';
import { AppIcon } from './ui';
export function AppearanceSettings({
  theme,
  onChange,
  database,
  storageName,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
  database: boolean;
  storageName: string;
}) {
  return (
    <section>
      <div className="section-intro">
        <h2>Make it your kind of workspace</h2>
        <p>Six colors, one clean white canvas. Your choice applies across the entire app.</p>
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
              style={{ '--preview-accent': item.color } as React.CSSProperties}
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
      <div className="subtle-note">
        <Palette size={15} />
        {database
          ? `Your theme saves to ${storageName} along with your workspace.`
          : 'Your theme is remembered in this browser. Connect Neon Postgres to share it between devices.'}
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
                      'Set DATABASE_URL and run the migration to enable database storage.',
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
              Run <code>npm run setup</code> to create missing security settings. Open{' '}
              <code>.env.local</code> to find your workspace password.
            </li>
            <li>
              On your laptop, add the URL to <code>.env.local</code>. On Vercel, add it to
              Environment Variables:
              <pre className="config-example">
                DATABASE_URL="paste-your-full-Neon-connection-string"
              </pre>
              Keep the actual database name from Neon (often <code>neondb</code>), not{' '}
              <code>relay</code> unless you created it. Copy plain text, with <code>&amp;</code>{' '}
              instead of HTML <code>&amp;amp;</code>.
            </li>
            <li>
              Run <code>npm run db:migrate</code> and <code>npm run db:check</code>. Restart Relay
              or redeploy Vercel. This creates Relay’s tables without deleting existing data.
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
              <strong>Your app stays local. Your saved data lives in Neon.</strong>
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
export function GoogleSettings({
  status,
  refresh,
  notify,
}: {
  status: Status;
  refresh: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
  const [secretSaved, setSecretSaved] = useState(false);
  const [redirect, setRedirect] = useState('');
  const [busy, setBusy] = useState('load');
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    api<{ clientId: string; secretSaved: boolean; redirectURI: string }>(
      '/api/google/config',
      undefined,
      'GET',
    )
      .then((data) => {
        if (!cancelled) {
          setClientId(data.clientId);
          setSecretSaved(data.secretSaved);
          setRedirect(data.redirectURI);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setBusy('');
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy('save');
    setError('');
    try {
      await api('/api/google/config', { clientId, clientSecret: secret });
      setSecret('');
      setSecretSaved(true);
      await refresh();
      notify(
        status.databaseConfigured
          ? `Google OAuth credentials encrypted and saved to ${databaseLabel(status)}.`
          : 'Google OAuth credentials saved in an encrypted browser session.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function connect() {
    setBusy('connect');
    setError('');
    try {
      const result = await api<{ url: string }>('/api/google/connect');
      window.location.assign(result.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy('');
    }
  }
  return (
    <>
      <div className="section-intro">
        <h2>Gmail & Google Sheets APIs</h2>
        <p>One Google OAuth connection gives your agent access to both services.</p>
      </div>
      <div className="google-api-summary">
        <AppIcon type="email" />
        <span>Gmail API</span>
        <span className="small-badge">Read & send</span>
        <AppIcon type="sheet" />
        <span>Sheets API</span>
        <span className="small-badge">Append rows</span>
      </div>
      <section className="settings-panel">
        <div className="panel-title">
          <KeyRound size={18} />
          <h3>Google OAuth client</h3>
          <span className={`small-badge ${status.googleEmail ? 'green' : ''}`}>
            {status.googleEmail
              ? 'Account connected'
              : secretSaved
                ? 'Credentials saved'
                : 'Not configured'}
          </span>
        </div>
        <form className="settings-form" onSubmit={save}>
          <label>
            Client ID
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Your client ID ending in .apps.googleusercontent.com"
              required
              maxLength={300}
            />
          </label>
          <label>
            Client secret{' '}
            <span className="optional">
              {secretSaved ? '(leave blank to keep saved secret)' : ''}
            </span>
            <input
              type="password"
              autoComplete="off"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={secretSaved ? 'Secret is saved securely' : 'Your OAuth client secret'}
              maxLength={500}
            />
          </label>
          <label>
            Authorized redirect URI
            <input
              readOnly
              value={redirect}
              placeholder="Set APP_URL in .env.local, then restart Relay"
            />
            <span>
              Copy this exact URI into your Google Cloud OAuth client’s authorized redirect URIs.
            </span>
          </label>
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <button className="button primary" disabled={!!busy || !clientId.trim()}>
              {busy === 'save' ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}
              Save Google credentials
            </button>
            <button
              type="button"
              className="button"
              disabled={!!busy || !status.googleConfigured}
              onClick={connect}
            >
              {busy === 'connect' && <LoaderCircle className="spin" size={15} />}{' '}
              {status.googleEmail ? 'Reconnect Google account' : 'Connect Google account'}
            </button>
          </div>
          {status.googleEmail && (
            <div className="connected-account">
              <Check size={14} />
              {status.googleEmail}
            </div>
          )}
          <div className="subtle-note">
            <ShieldCheck size={14} />
            {status.databaseConfigured
              ? `Secrets and Google tokens are encrypted in ${databaseLabel(status)}, not sent back to the browser.`
              : `Secrets are encrypted in HTTP-only cookies. Add ${databaseLabel(status)} to keep them across browsers.`}
          </div>
          <button
            type="button"
            className="text-button danger-text"
            disabled={!!busy}
            onClick={async () => {
              if (
                !window.confirm(
                  'Remove saved Google credentials and disconnect this account? Environment credentials, if any, will remain available.',
                )
              )
                return;
              setBusy('remove');
              try {
                await api('/api/google/config', undefined, 'DELETE');
                await refresh();
                const config = await api<{ clientId: string; secretSaved: boolean }>(
                  '/api/google/config',
                  undefined,
                  'GET',
                );
                setClientId(config.clientId);
                setSecretSaved(config.secretSaved);
                notify('Saved Google credentials removed; account disconnected.');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy('');
              }
            }}
          >
            <Unplug size={13} />
            Remove saved Google credentials
          </button>
        </form>
      </section>
      <div className="info-callout">
        <ShieldCheck size={19} />
        <div>
          <strong>A Google API key alone cannot access your private inbox</strong>
          <p>
            In Google Cloud, enable Gmail API and Google Sheets API. Configure the OAuth consent
            screen, add your Google account as a test user, and create a Web application OAuth
            client. Save its credentials here, then sign in with Google. Email sends and spreadsheet
            writes still require your approval.
          </p>
        </div>
      </div>
    </>
  );
}
