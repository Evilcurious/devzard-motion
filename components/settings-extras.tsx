'use client';
import { databaseLabel } from '@/lib/database-label';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Database,
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
export function GoogleSettings({
  status,
  refresh,
  notify,
}: {
  status: Status;
  refresh: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const [redirect, setRedirect] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    api<{ redirectURI: string }>('/api/google/config', undefined, 'GET')
      .then((data) => {
        if (!cancelled) setRedirect(data.redirectURI);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
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
    <>
      <div className="section-intro">
        <h2>Connect Google once</h2>
        <p>One Google sign-in securely connects both Gmail and Google Sheets.</p>
      </div>
      <div className="google-api-summary">
        <AppIcon type="email" />
        <span>Gmail</span>
        <span className="small-badge">Read & send</span>
        <AppIcon type="sheet" />
        <span>Google Sheets</span>
        <span className="small-badge">Append rows</span>
      </div>
      <section className="settings-panel">
        <div className="panel-title">
          <ShieldCheck size={18} />
          <h3>Your Google account</h3>
          <span className={`small-badge ${status.googleEmail ? 'green' : ''}`}>
            {status.googleEmail
              ? 'Connected'
              : status.googleConfigured
                ? 'Ready to connect'
                : 'Setup needed'}
          </span>
        </div>
        <p className="settings-help">
          Click once, choose your Google account, and approve the requested Gmail and Sheets access.
          Relay never needs your Google password. Email sends and spreadsheet changes still require
          your approval in chat.
        </p>
        {status.googleEmail && (
          <div className="connected-account">
            <Check size={14} /> Connected as {status.googleEmail}
          </div>
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <div className="form-actions">
          <button
            className="button primary"
            onClick={() => void connect()}
            disabled={busy || !status.googleConfigured}
          >
            {busy ? <LoaderCircle size={15} className="spin" /> : <ArrowUpRight size={15} />}
            {status.googleEmail ? 'Reconnect with Google' : 'Sign in with Google'}
          </button>
          {status.googleEmail && (
            <button className="button" onClick={() => void disconnect()} disabled={busy}>
              <Unplug size={15} /> Disconnect
            </button>
          )}
        </div>
        <div className="subtle-note">
          <ShieldCheck size={14} />
          {status.databaseConfigured
            ? `Google access tokens are encrypted in ${databaseLabel(status)} and never returned to your browser.`
            : 'Google access tokens are stored in a secure, encrypted, HTTP-only session cookie.'}
        </div>
      </section>
      {!status.googleConfigured && (
        <div className="info-callout">
          <ShieldCheck size={19} />
          <div>
            <strong>One-time setup for the Relay deployment owner</strong>
            <p>
              The app owner must configure a Google OAuth client and enable Gmail and Google Sheets
              APIs once. After that, users only sign in and grant access here—no client ID or secret
              entry is needed in Relay.
            </p>
            {redirect && (
              <code className="oauth-redirect-uri">Authorized redirect URI: {redirect}</code>
            )}
          </div>
        </div>
      )}
    </>
  );
}
