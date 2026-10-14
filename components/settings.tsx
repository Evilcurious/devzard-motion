'use client';
import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Globe2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Monitor,
  Server,
  ShieldCheck,
} from 'lucide-react';
import type { Status } from '@/lib/client-types';
import { AppIcon } from './ui';
export async function api<T = Record<string, unknown>>(
  url: string,
  body?: unknown,
  method = 'POST',
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
  return data;
}
export function Settings({
  status,
  refresh,
  notify,
}: {
  status: Status;
  refresh: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const [provider, setProvider] = useState(status.provider || 'openai');
  const [model, setModel] = useState(status.model || 'gpt-4o-mini');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('model');
  async function save() {
    setBusy('save');
    setError('');
    try {
      await api('/api/config', { provider, model, key });
      setKey('');
      await refresh();
      notify('Model settings saved securely.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function reset() {
    setBusy('reset');
    setError('');
    try {
      await api('/api/config', undefined, 'DELETE');
      setKey('');
      await refresh();
      notify('Saved model settings removed. Using server defaults.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function test() {
    setBusy('test');
    setError('');
    try {
      const data = await api<{ message: string }>('/api/model/test');
      notify(data.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="page-content">
      <div className="page-heading">
        <div className="eyebrow">MAKE IT YOURS</div>
        <h1>Settings</h1>
        <p>Your model. Your machine. Your way of working.</p>
      </div>
      <div className="tabs">
        <button className={tab === 'model' ? 'active' : ''} onClick={() => setTab('model')}>
          AI model
        </button>
        <button
          className={tab === 'deployment' ? 'active' : ''}
          onClick={() => setTab('deployment')}
        >
          Deployment & privacy
        </button>
        <button className={tab === 'guide' ? 'active' : ''} onClick={() => setTab('guide')}>
          Setup guide
        </button>
      </div>
      {tab === 'model' && (
        <>
          <div className="section-intro">
            <h2>A brain for your agent</h2>
            <p>Connect an API or keep everything local with Ollama.</p>
          </div>
          <div className="provider-options">
            {[
              {
                id: 'openai',
                title: 'OpenAI',
                description: 'Fast, capable cloud models',
                icon: 'api',
              },
              {
                id: 'ollama',
                title: 'Ollama',
                description: 'Models on your own machine',
                icon: 'ollama',
              },
              {
                id: 'compatible',
                title: 'Other API',
                description: 'OpenAI-compatible endpoint',
                icon: 'sparkles',
              },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setProvider(item.id);
                  setKey('');
                  setModel(
                    item.id === status.provider
                      ? status.model!
                      : item.id === 'ollama'
                        ? 'qwen2.5:7b'
                        : item.id === 'openai'
                          ? 'gpt-4o-mini'
                          : '',
                  );
                  setError('');
                }}
                className={`provider-option ${provider === item.id ? 'selected' : ''}`}
              >
                <AppIcon type={item.icon as 'api'} />
                <span className="radio-dot">{provider === item.id && <span />}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </button>
            ))}
          </div>
          <section className="settings-panel">
            <div className="panel-title">
              <KeyRound size={18} />
              <h3>Connection details</h3>
              <span className={`small-badge ${status.aiConfigured ? 'green' : ''}`}>
                {status.aiConfigured ? 'Configured' : 'Not connected'}
              </span>
            </div>
            <div className="settings-form">
              <label>
                Model name
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={
                    provider === 'ollama'
                      ? 'qwen2.5:7b'
                      : provider === 'openai'
                        ? 'gpt-4o-mini'
                        : 'Your provider’s model ID'
                  }
                />
                <span>Use a model that supports tool calling for email and spreadsheet tasks.</span>
              </label>
              {provider !== 'ollama' && (
                <label>
                  API key{' '}
                  <span className="optional">
                    {status.aiConfigured
                      ? '(leave blank to keep existing)'
                      : provider === 'compatible'
                        ? '(if required)'
                        : ''}
                  </span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="Enter your API key"
                  />
                  <span>
                    <LockKeyhole size={12} /> Encrypted in an HTTP-only cookie. Never stored in
                    browser history.
                  </span>
                </label>
              )}
              {provider === 'ollama' && (
                <div className="info-callout">
                  <Monitor size={19} />
                  <div>
                    <strong>Local intelligence, zero API fees</strong>
                    <p>
                      Install Ollama and run <code>ollama pull qwen2.5:7b</code>. Relay connects to
                      the server’s localhost:11434 by default. Vercel needs a reachable, secured
                      remote endpoint.
                    </p>
                  </div>
                </div>
              )}
              {provider === 'compatible' && (
                <div className="info-callout">
                  <Server size={19} />
                  <div>
                    <strong>Bring your own endpoint</strong>
                    <p>
                      Set <code>AI_BASE_URL</code> in your server environment, including{' '}
                      <code>/v1</code>. Endpoint URLs stay server-controlled for security.
                    </p>
                  </div>
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
                  disabled={!!busy || !model.trim()}
                  onClick={save}
                >
                  {busy === 'save' ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Check size={16} />
                  )}
                  Save connection
                </button>
                <button className="button" disabled={!!busy || !status.aiConfigured} onClick={test}>
                  {busy === 'test' && <LoaderCircle className="spin" size={16} />}Test saved
                  connection
                </button>
                <button className="text-button" disabled={!!busy} onClick={reset}>
                  {busy === 'reset' && <LoaderCircle className="spin" size={14} />}
                  Use server defaults
                </button>
              </div>
            </div>
          </section>
          <div className="subtle-note">
            <ShieldCheck size={15} /> API keys stay server-side during AI calls. Add SESSION_SECRET
            to enable encrypted settings.
          </div>
        </>
      )}
      {tab === 'deployment' && (
        <>
          <section className="settings-panel">
            <div className="panel-title">
              <Server size={18} />
              <h3>Where Relay runs</h3>
            </div>
            <div className="deployment-grid">
              <div>
                <Monitor size={25} />
                <h3>On your computer</h3>
                <p>
                  Run with Node.js 20.9+ and connect a cloud API or local Ollama model. No cloud
                  hosting required.
                </p>
                <Code text={'npm install\ncp .env.example .env.local\nnpm run dev'} />
              </div>
              <div>
                <Globe2 size={25} />
                <h3>On Vercel or your host</h3>
                <p>
                  Deploy this Next.js repository. Set your environment variables and use HTTPS.
                  Vercel hosts the app, not a local LLM.
                </p>
                <span className="small-badge green">
                  {status.deployment === 'vercel' ? 'Running on Vercel' : 'Currently self-hosted'}
                </span>
              </div>
            </div>
          </section>
          <section className="settings-panel">
            <div className="panel-title">
              <ShieldCheck size={18} />
              <h3>Designed to keep you in control</h3>
            </div>
            <div className="privacy-list">
              <Privacy
                title="Approval before action"
                text="Emails and spreadsheet changes require your explicit approval. Reading connected emails does not."
              />
              <Privacy
                title="Local conversation history"
                text="Chats, extracted document text, activity and workflows are saved in this browser. They are not synced between devices. Clear them in Activity."
              />
              <Privacy
                title="Your data, your provider"
                text="Messages, document text and tool results go to the AI provider you choose. For local processing, use Ollama on your own machine."
              />
              <Privacy
                title={
                  status.passwordProtected
                    ? 'Workspace password is enabled'
                    : 'This workspace has no password'
                }
                text={
                  status.passwordProtected
                    ? 'Your workspace is protected with APP_PASSWORD.'
                    : 'Set APP_PASSWORD and SESSION_SECRET before exposing this server to the internet. Required on Vercel.'
                }
              />
            </div>
          </section>
        </>
      )}
      {tab === 'guide' && (
        <div className="setup-guide">
          <GuideStep number="01" title="Start your workspace">
            <p>Install Node.js 20.9 or newer, open this project and run:</p>
            <Code
              text={
                'npm install\ncp .env.example .env.local\n# Generate a secret and add it to SESSION_SECRET:\nopenssl rand -hex 32\nnpm run dev'
              }
            />
            <p>
              Set <code>APP_PASSWORD</code> for any public deployment. Add a stable{' '}
              <code>SESSION_SECRET</code> before connecting accounts. Restart after changing
              environment variables.
            </p>
          </GuideStep>
          <GuideStep number="02" title="Choose your intelligence">
            <p>Enter an API key in the AI model tab, or configure your server directly:</p>
            <Code text={'AI_PROVIDER=openai\nAI_MODEL=gpt-4o-mini\nAI_API_KEY=your-api-key'} />
            <p>Prefer local? Install Ollama, pull a tool-capable model and set:</p>
            <Code
              text={
                'AI_PROVIDER=ollama\nAI_MODEL=qwen2.5:7b\nAI_BASE_URL=http://localhost:11434/v1'
              }
            />
          </GuideStep>
          <GuideStep number="03" title="Connect Google">
            <p>
              In Google Cloud Console, enable the <strong>Gmail API</strong> and{' '}
              <strong>Google Sheets API</strong>. Configure an OAuth consent screen and add yourself
              as a test user. Create a <strong>Web application</strong> OAuth client.
            </p>
            <Code
              text={
                'APP_URL=http://localhost:3000\nGOOGLE_CLIENT_ID=your-client-id\nGOOGLE_CLIENT_SECRET=your-client-secret\n# Authorized redirect URI in Google Cloud:\nhttp://localhost:3000/api/google/callback'
              }
            />
            <p>
              For hosting, replace localhost with your HTTPS domain in both places. Open Connections
              to authorize your account. Testing-mode Google tokens may expire after seven days.
            </p>
          </GuideStep>
          <GuideStep number="04" title="Make your first task happen">
            <p>
              Ask Relay to draft an email, or attach a text-based PDF and share your spreadsheet
              URL, tab and desired columns. Review the proposed action, then approve it. Workflows
              are reusable, manually triggered prompts, not scheduled jobs.
            </p>
          </GuideStep>
        </div>
      )}
    </div>
  );
}
function Privacy({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <CheckCircle2 size={18} />
      <section>
        <h4>{title}</h4>
        <p>{text}</p>
      </section>
    </div>
  );
}
function GuideStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="guide-step">
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        {children}
      </div>
    </section>
  );
}
function Code({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-block">
      <pre>{text}</pre>
      <button
        className="icon-button"
        aria-label="Copy configuration"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            /* The displayed code remains selectable if clipboard permissions are unavailable. */
          }
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}
