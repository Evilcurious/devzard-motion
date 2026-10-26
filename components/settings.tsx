'use client';
import { databaseLabel } from '@/lib/database-label';
import {
  GEMINI_BASE_URL,
  OPENROUTER_BASE_URL,
  OPENROUTER_FREE_MODEL,
  FREELLMAPI_BASE_URL,
} from '@/lib/ai-presets';
import { isFreeLLMAPIEndpoint, isGeminiEndpoint, isOpenRouterEndpoint } from '@/lib/ai-errors';
import { useState, useEffect } from 'react';
import { api } from '@/lib/client-api';
export { api } from '@/lib/client-api';
import { AppearanceSettings, GoogleSettings, StorageSettings } from './settings-extras';
import { type Theme } from '@/lib/themes';
import type { Appearance } from '@/lib/appearance';
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
export function Settings({
  status,
  refresh,
  notify,
  theme,
  onThemeChange,
  appearance,
  onAppearanceChange,
}: {
  status: Status;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  appearance: Appearance;
  onAppearanceChange: (appearance: Appearance) => void;
  refresh: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const [provider, setProvider] = useState(status.provider || 'openai');
  const [model, setModel] = useState(status.model || 'gpt-4o-mini');
  const [key, setKey] = useState('');
  const [baseURL, setBaseURL] = useState(status.baseURL || 'https://api.openai.com/v1');
  useEffect(() => {
    setProvider(status.provider || 'openai');
    setModel(status.model || 'gpt-4o-mini');
    setBaseURL(status.baseURL || 'https://api.openai.com/v1');
  }, [status.provider, status.model, status.baseURL]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('model');
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const gemini = provider === 'compatible' && isGeminiEndpoint(baseURL);
  const openRouter = provider === 'compatible' && isOpenRouterEndpoint(baseURL);
  const freeLLMAPI = provider === 'compatible' && isFreeLLMAPIEndpoint(baseURL);
  useEffect(() => {
    setGeminiModels([]);
  }, [provider, baseURL, key]);
  async function loadModels() {
    setBusy('models');
    setError('');
    setGeminiModels([]);
    try {
      const data = await api<{ models: string[] }>('/api/model/models', { key });
      setGeminiModels(data.models);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function save() {
    setBusy('save');
    setError('');
    try {
      await api('/api/config', { provider, model, key, baseURL });
      setKey('');
      await refresh();
      notify(
        status.databaseConfigured
          ? `API connection encrypted and saved to ${databaseLabel(status)}.`
          : 'API connection saved in an encrypted browser session.',
      );
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
      {!status.secureSettings && (
        <div className="info-callout">
          <ShieldCheck size={18} />
          <div>
            <strong>One-time setup needed to save API connections</strong>
            <p>
              In your project terminal, run <code>npm run setup</code>, then restart Relay. This
              creates missing encryption and password settings in .env.local without overwriting
              your existing values. Use APP_PASSWORD from that file to sign in.
            </p>
          </div>
        </div>
      )}
      {status.connectionError && (
        <div className="error-box" role="alert">
          {status.connectionError}
        </div>
      )}
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
        <button className={tab === 'google' ? 'active' : ''} onClick={() => setTab('google')}>
          Google APIs
        </button>
        <button className={tab === 'storage' ? 'active' : ''} onClick={() => setTab('storage')}>
          Database
        </button>
        <button
          className={tab === 'appearance' ? 'active' : ''}
          onClick={() => setTab('appearance')}
        >
          Appearance
        </button>
        <button className={tab === 'guide' ? 'active' : ''} onClick={() => setTab('guide')}>
          Setup guide
        </button>
      </div>
      {tab === 'appearance' && (
        <AppearanceSettings
          theme={theme}
          onChange={onThemeChange}
          appearance={appearance}
          onAppearanceChange={onAppearanceChange}
          database={!!status.databaseConfigured}
          storageName={databaseLabel(status)}
        />
      )}
      {tab === 'google' && <GoogleSettings status={status} refresh={refresh} notify={notify} />}
      {tab === 'storage' && <StorageSettings status={status} refresh={refresh} notify={notify} />}
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
                disabled={!!busy}
                onClick={() => {
                  setProvider(item.id);
                  setBaseURL(
                    item.id === status.provider
                      ? status.baseURL || ''
                      : item.id === 'ollama'
                        ? 'http://localhost:11434/v1'
                        : item.id === 'openai'
                          ? 'https://api.openai.com/v1'
                          : '',
                  );
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
          <div className="info-callout gemini-preset">
            <Globe2 size={19} />
            <div>
              <strong>Using a Google Gemini API key?</strong>
              <p>
                Gemini’s official endpoint is trusted by default. No AI_ALLOWED_ORIGINS change is
                needed.
              </p>
              <button
                className="button small"
                type="button"
                disabled={!!busy}
                onClick={() => {
                  setProvider('compatible');
                  setBaseURL(GEMINI_BASE_URL);
                  setModel(
                    status.provider === 'compatible' &&
                      status.baseURL?.replace(/\/$/, '') === GEMINI_BASE_URL
                      ? status.model || ''
                      : '',
                  );
                  setKey('');
                  setError('');
                }}
              >
                Use Gemini settings
              </button>
            </div>
          </div>
          <div className="info-callout openrouter-preset">
            <Globe2 size={19} />
            <div>
              <strong>Use OpenRouter’s unified model API</strong>
              <p>
                Connect one OpenRouter key to its catalog of models. The free-model router is a
                convenient starting point; free availability, rate limits and tool support vary.
              </p>
              <button
                className="button small"
                type="button"
                disabled={!!busy}
                onClick={() => {
                  setProvider('compatible');
                  setBaseURL(OPENROUTER_BASE_URL);
                  setModel(
                    status.provider === 'compatible' && isOpenRouterEndpoint(status.baseURL || '')
                      ? status.model || OPENROUTER_FREE_MODEL
                      : OPENROUTER_FREE_MODEL,
                  );
                  setKey('');
                  setError('');
                  setGeminiModels([]);
                }}
              >
                Use OpenRouter settings
              </button>
            </div>
          </div>
          <div className="info-callout freellmapi-preset">
            <Server size={19} />
            <div>
              <strong>Connect local FreeLLMAPI</strong>
              <p>
                Use your local OpenAI-compatible server. The preset fills in its loopback base URL;
                enter your API key and the model ID configured in FreeLLMAPI.
              </p>
              <button
                className="button small"
                type="button"
                disabled={!!busy}
                onClick={() => {
                  setProvider('compatible');
                  setBaseURL(FREELLMAPI_BASE_URL);
                  setModel(
                    status.provider === 'compatible' && isFreeLLMAPIEndpoint(status.baseURL || '')
                      ? status.model || ''
                      : '',
                  );
                  setKey('');
                  setError('');
                  setGeminiModels([]);
                }}
              >
                Use FreeLLMAPI settings
              </button>
            </div>
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
                  disabled={!!busy}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={
                    provider === 'ollama'
                      ? 'qwen2.5:7b'
                      : provider === 'openai'
                        ? 'gpt-4o-mini'
                        : openRouter
                          ? OPENROUTER_FREE_MODEL
                          : 'Your provider’s model ID'
                  }
                />
                <span>
                  {gemini
                    ? 'Load Gemini models below to choose a current text/chat model, then save and test it. Model names and availability change over time.'
                    : openRouter
                      ? 'Use openrouter/free to let OpenRouter choose an eligible free model, or enter a specific model ID from its model catalog.'
                      : freeLLMAPI
                        ? 'Enter the exact model ID configured by your local FreeLLMAPI server.'
                        : 'Use a model that supports tool calling for email and spreadsheet tasks.'}
                </span>
              </label>
              {provider !== 'openai' && (
                <label>
                  API endpoint
                  <input
                    value={baseURL}
                    disabled={!!busy}
                    onChange={(e) => setBaseURL(e.target.value)}
                    placeholder="http://localhost:11434/v1"
                    maxLength={500}
                  />
                  <span>
                    Use your provider’s OpenAI-compatible base URL. Gemini uses /v1beta/openai;
                    OpenRouter uses /api/v1. The local FreeLLMAPI preset uses 127.0.0.1:31415/v1.
                    Custom hosts need AI_ALLOWED_ORIGINS in .env.local.
                  </span>
                </label>
              )}
              {provider !== 'ollama' && (
                <label>
                  API key{' '}
                  <span className="optional">
                    {status.keySaved && provider === status.provider
                      ? '(leave blank to keep existing)'
                      : provider === 'compatible'
                        ? gemini
                          ? '(Gemini key required)'
                          : openRouter
                            ? '(OpenRouter key required)'
                            : freeLLMAPI
                              ? '(FreeLLMAPI key required)'
                              : '(if required)'
                        : ''}
                  </span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={key}
                    disabled={!!busy}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder={
                      status.keySaved && provider === status.provider
                        ? 'API key saved securely — leave blank to keep it'
                        : 'Enter your API key'
                    }
                  />
                  <span>
                    <LockKeyhole size={12} />{' '}
                    {status.databaseConfigured
                      ? `Encrypted in ${databaseLabel(status)}. Saved keys are never returned to the browser.`
                      : `Encrypted in an HTTP-only cookie. Enable ${databaseLabel(status)} for permanent storage.`}
                  </span>
                </label>
              )}
              {gemini && (
                <div className="info-callout">
                  <Globe2 size={19} />
                  <div>
                    <strong>Find a current Gemini model</strong>
                    <p>
                      Uses the key entered above, or your saved Gemini key. Loading the catalog does
                      not save settings or generate a reply.
                    </p>
                    <button
                      className="button small"
                      type="button"
                      disabled={!!busy}
                      onClick={loadModels}
                    >
                      {busy === 'models' && <LoaderCircle className="spin" size={16} />}
                      Load Gemini models
                    </button>
                    {geminiModels.length > 0 && (
                      <label>
                        Gemini generation models
                        <select
                          value={geminiModels.includes(model) ? model : ''}
                          disabled={!!busy}
                          onChange={(event) => setModel(event.target.value)}
                        >
                          <option value="" disabled>
                            Choose a text/chat model
                          </option>
                          {geminiModels.map((id) => (
                            <option key={id} value={id}>
                              {id}
                            </option>
                          ))}
                        </select>
                        <span>
                          Choose a text/chat model, not an image or audio-only model. Listing does
                          not guarantee OpenAI-compatible chat, tool support or quota. Click Save
                          connection, then Test saved connection to check it.
                        </span>
                      </label>
                    )}
                  </div>
                </div>
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
                    <strong>
                      {openRouter
                        ? 'OpenRouter connection'
                        : freeLLMAPI
                          ? 'Local FreeLLMAPI connection'
                          : 'Bring your own endpoint'}
                    </strong>
                    <p>
                      {openRouter ? (
                        <>
                          Use the exact base URL <code>{OPENROUTER_BASE_URL}</code> and your
                          OpenRouter API key. Relay sends it privately as a bearer credential.
                          OpenRouter is trusted by default, so no AI_ALLOWED_ORIGINS entry is
                          needed. Free model access and usage limits are controlled by OpenRouter.
                        </>
                      ) : freeLLMAPI ? (
                        <>
                          This preset uses <code>{FREELLMAPI_BASE_URL}</code> and works when Relay
                          and FreeLLMAPI run on the same computer. It will not reach your computer
                          from Vercel or another remote host. Enter the API key here; Relay stores
                          it encrypted and never returns it to the browser.
                        </>
                      ) : (
                        <>
                          Enter your provider’s OpenAI-compatible base URL above. Gemini uses{' '}
                          <code>/v1beta/openai</code> and is trusted by default. Other custom
                          origins must be allowed with AI_ALLOWED_ORIGINS on the server.
                        </>
                      )}
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
                title={
                  status.databaseConfigured
                    ? `${databaseLabel(status)} conversation history`
                    : 'Local conversation history'
                }
                text={
                  status.databaseConfigured
                    ? `Chats, document text, activity, workflows and theme are saved in your shared ${databaseLabel(status)} workspace. A browser backup is also kept. API credentials are encrypted separately.`
                    : `Chats, document text, activity and workflows are saved in this browser. Configure ${databaseLabel(status)} in the Database tab to persist across browsers.`
                }
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
                'npm install\nnpm run setup\n# Optional: set DATABASE_URL in .env.local, then:\nnpm run db:migrate\nnpm run dev'
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
