'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client-api';
import { Modal } from './ui';
import { rankRouterTargets, type RouterProviderId, type RouterTarget } from '@/lib/model-router';
import {
  Check,
  CircleHelp,
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react';

type Provider = {
  id: string;
  name: string;
  category: 'models' | 'search';
  keyRequired: boolean;
  connected: boolean;
  keySaved: boolean;
  keyCount: number;
  maxKeys: number;
  docsURL: string;
  note: string | null;
};
type ModelProvider = {
  id: RouterProviderId;
  name: string;
  modelId: string;
  contextTokens: number | null;
  availableTokens: number | null;
  supportsTools: boolean | null;
  supportsVision?: boolean | null;
  monthlyTokenBudget?: string | null;
  isFree: boolean;
  accountCreditsAvailable?: boolean;
};
type Model = {
  key: string;
  id: string;
  name: string;
  providers: ModelProvider[];
  contextTokens: number | null;
  availableTokens: number | null;
  isFree: boolean;
};
type Strategy = 'auto' | 'fusion';
type Target = RouterTarget;
type ObservedModelStats = {
  providerId: string;
  modelId: string | null;
  requests: number;
  successes: number;
  failures: number;
  successRate: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  averageLatencyMs: number | null;
  p95LatencyMs: number | null;
};
type Catalog = {
  models: Model[];
  providers: Array<{
    providerId: string;
    modelCount: number;
    listedCount?: number;
    error: string | null;
    accountBalanceLabel?: string | null;
  }>;
  refreshedAt: string;
  sourceCatalog?: { version: string; generatedAt: string; tier: 'live' | 'monthly' } | null;
  sourceCatalogError?: string | null;
  metricsNote: string;
};

const providerNames: Record<string, string> = {
  openrouter: 'OpenRouter',
  siliconflow: 'SiliconFlow',
  'ollama-cloud': 'Ollama Cloud',
  kilo: 'Kilo Gateway',
  ovh: 'OVH AI Endpoints',
  agnes: 'Agnes AI',
  routeway: 'Routeway',
  bazaarlink: 'BazaarLink',
  requesty: 'Requesty',
  aihorde: 'AI Horde',
  electronhub: 'Electron Hub',
  xkiro: 'xKiro',
  septorlabs: 'Septor Labs',
  bluesminds: 'BluesMinds',
  firecrawl: 'Firecrawl',
  parallel: 'Parallel',
  keenable: 'KeenAble',
  gemini: 'Google Gemini API',
  speka: 'Speka',
  kenari: 'Kenari',
  kiosapi: 'KiosAPI',
  typhoon: 'Typhoon',
  plugsky: 'Plugsky',
  inferbase: 'Inferbase',
  simplellm: 'SimpleLLM',
  llmtr: 'LLMTR',
  gizmo: 'Gizmo',
  blockrun: 'BlockRun',
  experiential: 'Experiential Labs',
  router9: 'Router9',
  clod: 'CLōD',
  blaze: 'BlazeAPI',
  lucidity: 'Lucidity',
  airforce: 'Api.Airforce',
  dreamprompting: 'DreamPrompting',
  waterfall: 'Waterfall',
  logfare: 'Logfare',
  apinex: 'APINex',
  onomeo: 'Onomeo',
  iteracompute: 'IteraCompute',
  bai: 'B.AI',
  anyapi: 'AnyAPI',
  llm7: 'LLM7',
  ainative: 'AINative Studio',
  aion: 'Aion Labs',
  navy: 'NavyAI',
  nara: 'NaraRouter',
  sealion: 'SEA-LION',
  orcarouter: 'OrcaRouter',
  unorouter: 'UnoRouter',
  qianfan: 'Baidu Qianfan',
  volcengine: 'Volcengine Ark',
  longcat: 'LongCat',
  xfyun: 'iFlytek Spark',
};
const targetKey = (target: Target) => `${target.providerId}::${target.modelId}`;
const formatTokens = (n: number | null) =>
  n === null ? 'Not reported' : `${n.toLocaleString()} tokens`;
const availabilityLabel = (
  providerId: string,
  isFree: boolean,
  tokens: number | null,
  accountCreditsAvailable = false,
) =>
  isFree
    ? providerId === 'ollama-cloud'
      ? 'Free usage credits'
      : 'Free'
    : tokens !== null
      ? formatTokens(tokens)
      : accountCreditsAvailable
        ? 'Account credits available'
        : providerId === 'bluesminds'
          ? 'Listed for your key'
          : 'Not reported';
const catalogTargets = (models: Model[]): Target[] =>
  models.flatMap((model) =>
    model.providers.map((provider) => ({
      providerId: provider.id,
      modelId: provider.modelId,
      availableTokens: provider.availableTokens,
      contextTokens: provider.contextTokens,
      supportsTools: provider.supportsTools,
      isFree: provider.isFree,
      accountCreditsAvailable: provider.accountCreditsAvailable,
    })),
  );
const enrichTarget = (target: Target, models: Model[]): Target =>
  catalogTargets(models).find((candidate) => targetKey(candidate) === targetKey(target)) || target;
function aggregateObservedStats(
  providers: ModelProvider[],
  statsByTarget: Record<string, ObservedModelStats>,
) {
  const rows = providers.flatMap((provider) => {
    const stats = statsByTarget[`${provider.id}::${provider.modelId}`];
    return stats ? [stats] : [];
  });
  if (!rows.length) return null;
  const requests = rows.reduce((sum, row) => sum + row.requests, 0);
  const successes = rows.reduce((sum, row) => sum + row.successes, 0);
  const latencyRows = rows.filter((row) => row.averageLatencyMs !== null && row.successes > 0);
  const latencyCount = latencyRows.reduce((sum, row) => sum + row.successes, 0);
  const averageLatencyMs = latencyCount
    ? latencyRows.reduce((sum, row) => sum + row.averageLatencyMs! * row.successes, 0) /
      latencyCount
    : null;
  return {
    requests,
    successRate: requests ? (successes / requests) * 100 : null,
    averageLatencyMs,
  };
}
function ObservedModelPerformance({
  providers,
  statsByTarget,
  status,
}: {
  providers: ModelProvider[];
  statsByTarget: Record<string, ObservedModelStats>;
  status: 'loading' | 'ready' | 'unavailable';
}) {
  const stats = aggregateObservedStats(providers, statsByTarget);
  return (
    <div
      className="model-observation"
      title="Aggregated from Relay calls over the last 30 days; not provider-wide ratings."
    >
      <small>Relay-observed performance · 30 days</small>
      <strong>
        {stats
          ? `${stats.requests.toLocaleString()} calls · ${stats.successRate === null ? '—' : `${stats.successRate.toFixed(1)}% success`} · ${stats.averageLatencyMs === null ? 'latency unavailable' : `${Math.round(stats.averageLatencyMs).toLocaleString()} ms avg successful call`}`
          : status === 'loading'
            ? 'Loading observed usage…'
            : status === 'unavailable'
              ? 'Usage analytics are unavailable'
              : 'No Relay calls observed in this period'}
      </strong>
    </div>
  );
}

export function ModelHub({
  onSelect,
  notify,
}: {
  onSelect: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [observedModelStats, setObservedModelStats] = useState<Record<string, ObservedModelStats>>(
    {},
  );
  const [modelStatsStatus, setModelStatsStatus] = useState<'loading' | 'ready' | 'unavailable'>(
    'loading',
  );
  const [selection, setSelection] = useState<Target | null>(null);
  const [strategy, setStrategy] = useState<Strategy>('auto');
  const [autoPick, setAutoPick] = useState(true);
  const [fusionModels, setFusionModels] = useState<Target[]>([]);
  const [connectId, setConnectId] = useState('');
  const [key, setKey] = useState('');
  const [quickProviderId, setQuickProviderId] = useState('openrouter');
  const [quickKey, setQuickKey] = useState('');
  const [filter, setFilter] = useState('');
  const [filterVision, setFilterVision] = useState(false);
  const [filterTools, setFilterTools] = useState(false);
  const [providerFilter, setProviderFilter] = useState('all');
  const [providerModelModal, setProviderModelModal] = useState<string | null>(null);
  const [category, setCategory] = useState<'all' | 'models' | 'search'>('all');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const selected =
    selection || rankRouterTargets(catalogTargets(catalog?.models || []), 'auto')[0] || null;

  async function loadProviders(): Promise<Provider[]> {
    const response = await api<{ providers: Provider[] }>(
      '/api/router/providers',
      undefined,
      'GET',
    );
    setProviders(response.providers);
    setQuickProviderId((current) =>
      response.providers.some((provider) => provider.id === current)
        ? current
        : response.providers.find((provider) => provider.id === 'openrouter')?.id ||
          response.providers.find((provider) => provider.category === 'models')?.id ||
          '',
    );
    return response.providers;
  }
  async function loadSelection() {
    const response = await api<{
      selection: null | {
        providerId: RouterProviderId;
        modelId: string;
        availableTokens?: number | null;
        contextTokens?: number | null;
        supportsTools?: boolean | null;
        isFree?: boolean;
        strategy: Strategy;
        autoPick?: boolean;
        fusionModels: Target[];
      };
    }>('/api/router/selection', undefined, 'GET');
    if (response.selection) {
      setSelection({
        providerId: response.selection.providerId,
        modelId: response.selection.modelId,
        availableTokens: response.selection.availableTokens,
        contextTokens: response.selection.contextTokens,
        supportsTools: response.selection.supportsTools,
        isFree: response.selection.isFree,
      });
      setStrategy(response.selection.strategy === 'fusion' ? 'fusion' : 'auto');
      setAutoPick(response.selection.autoPick ?? true);
      setFusionModels(response.selection.fusionModels || []);
    }
    return response.selection;
  }
  async function loadObservedModelStats() {
    try {
      const response = await api<{
        models: ObservedModelStats[];
        storage: 'postgresql' | 'memory' | 'unavailable';
      }>('/api/analytics?range=30d', undefined, 'GET');
      setObservedModelStats(
        Object.fromEntries(
          response.models
            .filter((row) => row.modelId)
            .map((row) => [`${row.providerId}::${row.modelId}`, row]),
        ),
      );
      setModelStatsStatus(response.storage === 'unavailable' ? 'unavailable' : 'ready');
    } catch {
      setObservedModelStats({});
      setModelStatsStatus('unavailable');
    }
  }
  async function discover(autoSelect = false): Promise<Catalog | null> {
    setBusy('discover');
    setError('');
    try {
      const result = await api<Catalog>('/api/router/models', undefined, 'GET');
      setCatalog(result);
      void loadObservedModelStats();
      setSelection((current) =>
        current && result.models.length ? enrichTarget(current, result.models) : current,
      );
      setFusionModels((current) => current.map((target) => enrichTarget(target, result.models)));
      if (autoSelect && !selection) {
        const first = rankRouterTargets(catalogTargets(result.models), 'auto')[0];
        if (first) {
          setSelection(first);
          setAutoPick(true);
        } else
          setError(
            'No models currently meet the eligibility checks: explicit free access, positive model quota, positive account-credit metadata, Ollama’s documented free-usage models, or an account-listed BluesMinds model. Refresh model lists or check API access.',
          );
      }
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy('');
    }
  }
  useEffect(() => {
    Promise.all([loadProviders(), loadSelection()])
      .then(([, savedSelection]) => discover(!savedSelection))
      .catch((e) => setError((e as Error).message));
  }, []);

  async function saveProvider(providerId: string, apiKey = key) {
    setBusy(providerId);
    setError('');
    try {
      await api('/api/router/providers', { providerId, apiKey });
      setKey('');
      setQuickKey('');
      setConnectId('');
      const savedProviders = await loadProviders();
      const refreshed = await discover();
      const provider = savedProviders.find((item) => item.id === providerId);
      if (provider?.category === 'models') setProviderModelModal(providerId);
      else if (refreshed)
        notify(`${providerNames[providerId] || providerId} connection saved securely.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function chooseProviderModel(provider: ModelProvider) {
    const target: Target = {
      providerId: provider.id,
      modelId: provider.modelId,
      availableTokens: provider.availableTokens,
      contextTokens: provider.contextTokens,
      supportsTools: provider.supportsTools,
      isFree: provider.isFree,
      accountCreditsAvailable: provider.accountCreditsAvailable,
    };
    setBusy('provider-model');
    setError('');
    try {
      await api('/api/router/selection', {
        ...target,
        strategy: 'auto',
        autoPick: false,
        fusionModels: [],
      });
      setSelection(target);
      setStrategy('auto');
      setAutoPick(false);
      setFusionModels([]);
      setProviderModelModal(null);
      await onSelect();
      notify(
        `${target.modelId} · ${providerNames[target.providerId] || target.providerId} is now active.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function removeProvider(providerId: string, keyIndex?: number) {
    setBusy(providerId);
    setError('');
    try {
      const result = await api<{ keyCount: number }>(
        '/api/router/providers',
        { providerId, keyIndex },
        'DELETE',
      );
      if (result.keyCount === 0 && selection?.providerId === providerId) {
        setSelection(null);
        setStrategy('auto');
      }
      setFusionModels((items) => items.filter((target) => target.providerId !== providerId));
      await loadProviders();
      await discover();
      notify(
        result.keyCount
          ? `${providerNames[providerId] || providerId} key removed. ${result.keyCount} key${result.keyCount === 1 ? '' : 's'} remain.`
          : `${providerNames[providerId] || providerId} connection removed.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function activate() {
    if (!selected) return;
    setBusy('activate');
    setError('');
    try {
      await api('/api/router/selection', {
        ...enrichTarget(selected, catalog?.models || []),
        strategy,
        autoPick: strategy === 'auto' && autoPick,
        fusionModels: strategy === 'fusion' ? fusionModels : [],
      });
      await onSelect();
      notify(`${selected.modelId} is now your active chat model.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  function toggleTarget(
    list: Target[],
    setList: (next: Target[]) => void,
    target: Target,
    max: number,
  ) {
    const key = targetKey(target);
    if (list.some((item) => targetKey(item) === key))
      setList(list.filter((item) => targetKey(item) !== key));
    else if (target.availableTokens !== 0 && list.length < max)
      setList([...list, enrichTarget(target, catalog?.models || [])]);
  }

  function autoPickPrimary() {
    const best = rankRouterTargets(catalogTargets(catalog?.models || []), 'auto')[0];
    if (!best) {
      setError(
        'No eligible models were found. Relay checks free access, positive model quota, account credits, Ollama’s documented free-usage models, and account-listed BluesMinds IDs. Refresh the catalog or connect another provider.',
      );
      return;
    }
    setSelection(best);
    setStrategy('auto');
    setAutoPick(true);
    setError('');
    notify(
      `Selected ${best.modelId} by quota-aware ranking from models the connected APIs report as eligible.`,
    );
  }

  const visibleProviders = providers.filter((p) => category === 'all' || p.category === category);
  const visibleModels = useMemo(
    () =>
      (catalog?.models || []).flatMap((model) => {
        const routes =
          providerFilter === 'all'
            ? model.providers
            : model.providers.filter((provider) => provider.id === providerFilter);
        const matchingRoutes = routes.filter(
          (route) =>
            (!filterVision || route.supportsVision === true) &&
            (!filterTools || route.supportsTools === true),
        );
        if (!matchingRoutes.length) return [];
        const haystack =
          `${model.name} ${model.id} ${matchingRoutes.map((p) => `${p.id} ${p.name}`).join(' ')}`.toLowerCase();
        if (!haystack.includes(filter.trim().toLowerCase())) return [];
        if (providerFilter === 'all' && !filterVision && !filterTools) return [model];
        const knownQuotas = matchingRoutes.map((route) => route.availableTokens);
        return [
          {
            ...model,
            providers: matchingRoutes,
            contextTokens: matchingRoutes.reduce<number | null>(
              (largest, route) =>
                route.contextTokens === null
                  ? largest
                  : Math.max(largest ?? 0, route.contextTokens),
              null,
            ),
            availableTokens: knownQuotas.some((quota) => quota === null)
              ? null
              : knownQuotas.reduce<number>((sum, quota) => sum + (quota || 0), 0),
            isFree: matchingRoutes.some((route) => route.isFree),
          },
        ];
      }),
    [catalog, filter, filterTools, filterVision, providerFilter],
  );
  const providerErrors = catalog?.providers.filter((provider) => provider.error) || [];
  const connectedModelProviders = providers.filter(
    (provider) => provider.category === 'models' && provider.connected,
  );
  const connectedProviderIds = new Set(connectedModelProviders.map((provider) => provider.id));
  const providersResponding =
    catalog?.providers.filter(
      (provider) => connectedProviderIds.has(provider.providerId) && !provider.error,
    ).length || 0;
  const allModelRoutes = (catalog?.models || []).flatMap((model) => model.providers);
  const totalModelRoutes = allModelRoutes.length;
  const totalReportedTokens = allModelRoutes.reduce(
    (sum, provider) => sum + (provider.availableTokens !== null ? provider.availableTokens : 0),
    0,
  );
  const routesWithPublishedBudgets = allModelRoutes.filter(
    (provider) => !!provider.monthlyTokenBudget,
  ).length;
  const quickProvider = providers.find((provider) => provider.id === quickProviderId);

  return (
    <div className="model-hub">
      <div className="model-hub-hero">
        <div>
          <span className="small-section-label">MODEL ROUTER</span>
          <h1>Models & providers</h1>
          <p>
            Connect multiple AI services, discover their models, and choose how Relay routes each
            chat.
          </p>
        </div>
        <button className="button" onClick={() => discover()} disabled={busy === 'discover'}>
          {busy === 'discover' ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <RefreshCw size={15} />
          )}{' '}
          Refresh models
        </button>
      </div>
      {error && (
        <div className="model-hub-error" role="alert">
          {error}
        </div>
      )}
      <section className="model-hub-section">
        <div className="section-heading">
          <div>
            <span className="small-section-label">CONNECTIONS</span>
            <h2>Provider keys</h2>
          </div>
          <span className="model-count">
            {providers.filter((p) => p.connected).length} connected
          </span>
        </div>
        <p className="model-hub-copy">
          Keys are encrypted in Relay storage and never sent to your browser after saving. Search
          services are listed separately from chat models.
        </p>
        <div className="provider-key-quickform">
          <label>
            Provider
            <select
              aria-label="Choose an AI provider"
              value={quickProviderId}
              onChange={(event) => setQuickProviderId(event.target.value)}
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} · {provider.category === 'models' ? 'Chat model' : 'Search'}
                </option>
              ))}
            </select>
          </label>
          {quickProvider?.keyRequired && (
            <label>
              API key
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Paste this provider’s API key"
                aria-label="API key for selected provider"
                value={quickKey}
                onChange={(event) => setQuickKey(event.target.value)}
              />
            </label>
          )}
          <button
            className="button primary"
            disabled={
              !!busy || !quickProviderId || (!!quickProvider?.keyRequired && !quickKey.trim())
            }
            onClick={() => void saveProvider(quickProviderId, quickKey)}
          >
            {busy === quickProviderId ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <Plus size={15} />
            )}
            {quickProvider?.keyRequired ? 'Save API key' : 'Connect provider'}
          </button>
        </div>
        {quickProvider?.category === 'search' && quickProvider.note && (
          <p className="provider-note">
            {quickProvider.id === 'firecrawl'
              ? 'Firecrawl is used when you turn on Web search in the chat composer.'
              : quickProvider.note}
          </p>
        )}
        <div className="provider-tabs">
          {(['all', 'models', 'search'] as const).map((tab) => (
            <button
              key={tab}
              className={category === tab ? 'active' : ''}
              onClick={() => setCategory(tab)}
            >
              {tab === 'all' ? 'All providers' : tab === 'models' ? 'Models' : 'Search'}
            </button>
          ))}
        </div>
        <div className="provider-grid">
          {visibleProviders.map((provider) => {
            const state = catalog?.providers.find((p) => p.providerId === provider.id);
            const modelStatus =
              state && state.modelCount > 0
                ? `${state.modelCount} eligible models`
                : state && (state.listedCount || 0) > 0
                  ? `${state.listedCount} listed · 0 eligible`
                  : state
                    ? '0 eligible models'
                    : '… models';
            return (
              <article className="provider-card" key={provider.id}>
                <div className="provider-card-top">
                  <span className={`provider-mark ${provider.category}`}>
                    {provider.category === 'models' ? 'AI' : 'S'}
                  </span>
                  <span
                    className={`health-pill ${state?.error ? 'error' : provider.connected ? 'ok' : ''}`}
                  >
                    <i />
                    {state?.error
                      ? 'Unavailable'
                      : provider.connected
                        ? provider.category === 'search'
                          ? 'Connected'
                          : modelStatus
                        : 'Not connected'}
                  </span>
                </div>
                <h3>{provider.name}</h3>
                <p>
                  {provider.category === 'models' ? 'Chat model provider' : 'Search integration'}
                </p>
                {state?.accountBalanceLabel && (
                  <small className="provider-balance-label">{state.accountBalanceLabel}</small>
                )}
                <a
                  className="provider-docs-link"
                  href={provider.docsURL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Provider site and API keys ↗
                </a>
                {provider.note && <small className="provider-note">{provider.note}</small>}
                {provider.category === 'models' && state?.error && (
                  <small className="provider-note error-text">{state.error}</small>
                )}
                <div className="provider-card-actions">
                  {provider.keyRequired && provider.keySaved ? (
                    <span className="key-saved">
                      <ShieldCheck size={14} /> {provider.keyCount} encrypted key
                      {provider.keyCount === 1 ? '' : 's'} saved
                    </span>
                  ) : null}
                  {connectId === provider.id ? (
                    <div className="key-entry">
                      {provider.keyRequired && (
                        <input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Paste API key"
                          value={key}
                          onChange={(e) => setKey(e.target.value)}
                          aria-label={`${provider.name} API key`}
                        />
                      )}
                      <button
                        className="button small"
                        disabled={busy === provider.id || (provider.keyRequired && !key.trim())}
                        onClick={() => saveProvider(provider.id)}
                      >
                        {busy === provider.id
                          ? 'Saving…'
                          : provider.keyRequired
                            ? 'Save key'
                            : 'Connect'}
                      </button>
                      <button
                        className="text-button"
                        onClick={() => {
                          setConnectId('');
                          setKey('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      {provider.keySaved
                        ? Array.from({ length: provider.keyCount }, (_, index) => (
                            <button
                              className="text-button danger-text"
                              key={`${provider.id}-key-${index}`}
                              onClick={() => removeProvider(provider.id, index)}
                              disabled={busy === provider.id}
                              title={`Remove saved API key ${index + 1}`}
                            >
                              <Trash2 size={14} /> Remove key {index + 1}
                            </button>
                          ))
                        : null}
                      <button
                        className="text-button"
                        onClick={() => {
                          setConnectId(provider.id);
                          setKey('');
                        }}
                      >
                        {provider.connected
                          ? 'Manage'
                          : provider.keyRequired
                            ? 'Add API key'
                            : 'Connect'}{' '}
                        <Plus size={14} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="model-hub-section">
        <div className="section-heading">
          <div>
            <span className="small-section-label">DISCOVERY</span>
            <h2>Model catalog</h2>
          </div>
          <span className="model-count">
            {catalog ? `${catalog.models.length} models` : 'Loading…'}
          </span>
        </div>
        <div className="model-count-summary" aria-live="polite">
          <span>
            <strong>{catalog?.models.length ?? 0}</strong> unique models
          </span>
          <span>
            <strong>{totalModelRoutes}</strong> provider/model routes
          </span>
          <span>
            <strong>{totalReportedTokens.toLocaleString()}</strong> reported remaining tokens
          </span>
          <span>
            <strong>
              {providersResponding}/{connectedModelProviders.length}
            </strong>{' '}
            connected providers responding
          </span>
          <small>
            Token total sums only provider-reported per-model remaining quotas; unknown quotas and
            account-wide credits are omitted, and shared account limits may make totals overlap.
          </small>
          <small>
            {catalog?.refreshedAt
              ? `Provider model lists and live quota fields last checked ${new Date(catalog.refreshedAt).toLocaleTimeString()}. Refresh to check again.`
              : 'Provider model and quota data has not been checked yet.'}
          </small>
          <small>
            {catalog?.sourceCatalog
              ? `FreeLLMAPI signed catalog ${catalog.sourceCatalog.version} · ${routesWithPublishedBudgets} connected routes have published monthly-budget metadata. This is a budget label, not live remaining tokens.`
              : catalog?.sourceCatalogError || 'Loading signed model-budget metadata…'}
          </small>
        </div>
        {catalog?.sourceCatalogError && (
          <div className="model-hub-warning" role="status">
            {catalog.sourceCatalogError} Live provider model lists and their reported token balances
            remain available.
          </div>
        )}
        <div className="model-tools">
          <label className="model-search">
            <Search size={16} />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search models or providers"
            />
          </label>
          <label className="model-provider-filter">
            <span>Provider</span>
            <select
              aria-label="Filter models by provider"
              value={providerFilter}
              onChange={(event) => setProviderFilter(event.target.value)}
            >
              <option value="all">All providers</option>
              {providers
                .filter((provider) => provider.category === 'models')
                .map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            className={`button small ${filterVision ? 'primary' : ''}`}
            type="button"
            aria-pressed={filterVision}
            onClick={() => setFilterVision((value) => !value)}
          >
            Vision
          </button>
          <button
            className={`button small ${filterTools ? 'primary' : ''}`}
            type="button"
            aria-pressed={filterTools}
            onClick={() => setFilterTools((value) => !value)}
          >
            Tools
          </button>
          <button
            className="button small"
            onClick={() => discover()}
            disabled={busy === 'discover'}
          >
            <RefreshCw size={14} /> Discover
          </button>
        </div>
        {providerErrors.length > 0 && (
          <div className="model-hub-warning">
            <CircleHelp size={15} /> Some providers could not be reached. Other providers may still
            have models available.
          </div>
        )}
        {visibleModels.length ? (
          <div className="model-list">
            {visibleModels.map((model) => (
              <article
                className={`model-row ${selected && model.providers.some((p) => p.id === selected.providerId && p.modelId === selected.modelId) ? 'selected' : ''}`}
                key={model.key}
              >
                <button
                  className="model-row-main"
                  onClick={() => {
                    setSelection({
                      providerId: model.providers[0].id,
                      modelId: model.providers[0].modelId,
                      isFree: model.providers[0].isFree,
                      availableTokens: model.providers[0].availableTokens,
                      contextTokens: model.providers[0].contextTokens,
                      supportsTools: model.providers[0].supportsTools,
                      accountCreditsAvailable: model.providers[0].accountCreditsAvailable,
                    });
                    setAutoPick(false);
                  }}
                >
                  <span className="model-icon">
                    <Zap size={17} />
                  </span>
                  <span className="model-primary">
                    <strong>{model.name}</strong>
                    <small>{model.id}</small>
                  </span>
                  <span className="model-provider-list">
                    {model.providers.map((p) => (
                      <span key={p.id} title={`${p.name}: ${p.modelId}`}>
                        {p.name}
                      </span>
                    ))}
                  </span>
                  <span className="model-metric">
                    <small>Largest context</small>
                    <strong>{formatTokens(model.contextTokens)}</strong>
                  </span>
                  <span className="model-metric">
                    <small>Availability</small>
                    <strong>
                      {model.isFree
                        ? availabilityLabel(
                            model.providers.find((provider) => provider.isFree)?.id || '',
                            true,
                            model.availableTokens,
                          )
                        : model.availableTokens !== null
                          ? formatTokens(model.availableTokens)
                          : model.providers.some((provider) => provider.accountCreditsAvailable)
                            ? 'Account credits available'
                            : 'Not reported'}
                    </strong>
                  </span>
                  <span
                    className="model-metric"
                    title="Cataloged monthly budget; not a live remaining-token count."
                  >
                    <small>Published monthly budget</small>
                    <strong>
                      {[
                        ...new Set(
                          model.providers
                            .map((provider) => provider.monthlyTokenBudget)
                            .filter(Boolean),
                        ),
                      ].join(' · ') || 'Not published'}
                    </strong>
                  </span>
                  <span className="model-check">
                    {selected &&
                      model.providers.some(
                        (p) => p.id === selected.providerId && p.modelId === selected.modelId,
                      ) && <Check size={16} />}
                  </span>
                </button>
                <ObservedModelPerformance
                  providers={model.providers}
                  statsByTarget={observedModelStats}
                  status={modelStatsStatus}
                />
                {model.providers.length > 1 && (
                  <div className="model-provider-choices">
                    Available through{' '}
                    {model.providers.map((p) => (
                      <button
                        key={p.id}
                        className={
                          selected?.providerId === p.id && selected.modelId === p.modelId
                            ? 'active'
                            : ''
                        }
                        onClick={() => {
                          setSelection({
                            providerId: p.id,
                            modelId: p.modelId,
                            isFree: p.isFree,
                            availableTokens: p.availableTokens,
                            contextTokens: p.contextTokens,
                            supportsTools: p.supportsTools,
                            accountCreditsAvailable: p.accountCreditsAvailable,
                          });
                          setAutoPick(false);
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="model-empty">
            {catalog?.models.length ? <Search size={20} /> : <KeyRound size={20} />}
            <strong>
              {catalog?.models.length
                ? 'No models match the current filters'
                : catalog
                  ? 'No eligible models were returned'
                  : 'Loading model catalog…'}
            </strong>
            <span>
              {catalog?.models.length
                ? 'Clear the search, provider, Vision, or Tools filters to show more results.'
                : catalog
                  ? 'Add provider keys above, then refresh. Some providers require authentication before listing models.'
                  : 'Provider model lists and signed monthly-budget metadata are loading.'}
            </span>
          </div>
        )}
        <p className="metrics-disclaimer">
          <CircleHelp size={13} />
          {catalog?.metricsNote ||
            'Context length is not account quota. Unknown quota and performance metrics are not estimated.'}
        </p>
        <div className="model-profile-note">
          <strong>Provider profiles</strong>
          <span>
            Relay-observed request success and latency are shown per model over the last 30 days.
            Intelligence and guardrail ratings are not measured here, and provider-wide ratings are
            not inferred from Relay traffic.
          </span>
        </div>
      </section>

      <section className="model-hub-section routing-section">
        <div className="section-heading">
          <div>
            <span className="small-section-label">ROUTING</span>
            <h2>Choose your chat strategy</h2>
          </div>
        </div>
        <div className="primary-model-picker-row">
          <p className="model-hub-copy">
            Primary model:{' '}
            <strong>
              {selected
                ? `${selected.modelId} · ${providerNames[selected.providerId] || selected.providerId}`
                : 'Select a model above'}
            </strong>
          </p>
          <button
            className="button small"
            type="button"
            onClick={autoPickPrimary}
            disabled={!catalog?.models.length}
          >
            <Zap size={14} /> Auto-pick available
          </button>
        </div>
        <div className="strategy-grid">
          {(
            [
              [
                'auto',
                'Auto select',
                'Use the best currently eligible model, then try the next by your chat density if the provider rejects it or reports exhausted quota.',
              ],
              [
                'fusion',
                'Fusion',
                'Ask multiple selected models, then synthesize their answers. Tools and approval actions are disabled in fusion mode.',
              ],
            ] as const
          ).map(([id, title, description]) => (
            <button
              key={id}
              className={`strategy-card ${strategy === id ? 'active' : ''}`}
              onClick={() => setStrategy(id)}
            >
              <span className="strategy-radio" />
              <strong>{title}</strong>
              <span>{description}</span>
            </button>
          ))}
        </div>
        {strategy === 'auto' && (
          <p className="route-quota-note">
            Only API-listed models with explicit free access, positive model quota, or positive
            account-credit metadata are available. Ollama’s documented free-usage models and
            OpenRouter’s live account/key credits are also checked. A failed or exhausted model is
            skipped for the next eligible choice.
          </p>
        )}
        {strategy === 'fusion' && (
          <div className="route-candidates">
            <div className="route-candidate-heading">
              <label>Fusion models (up to 3 additional; 4 total)</label>
            </div>
            <div className="route-model-options">
              {(catalog?.models || []).flatMap((model) =>
                model.providers.map((provider) => {
                  const target: Target = {
                    providerId: provider.id,
                    modelId: provider.modelId,
                    availableTokens: provider.availableTokens,
                    contextTokens: provider.contextTokens,
                    supportsTools: provider.supportsTools,
                    isFree: provider.isFree,
                    accountCreditsAvailable: provider.accountCreditsAvailable,
                  };
                  const checked = fusionModels.some(
                    (item) => targetKey(item) === targetKey(target),
                  );
                  return (
                    <label key={targetKey(target)}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={
                          (!checked && fusionModels.length >= 3) ||
                          targetKey(target) === (selected ? targetKey(selected) : '')
                        }
                        onChange={() => toggleTarget(fusionModels, setFusionModels, target, 3)}
                      />
                      <span>{provider.name}</span>
                      <small>{provider.modelId}</small>
                      <small>
                        {availabilityLabel(
                          provider.id,
                          provider.isFree,
                          provider.availableTokens,
                          provider.accountCreditsAvailable,
                        )}
                      </small>
                    </label>
                  );
                }),
              )}
            </div>
          </div>
        )}
        <div className="routing-footer">
          <span>
            <ShieldCheck size={14} /> Keys remain encrypted. API calls go directly from Relay’s
            server to the selected provider.
          </span>
          <button
            className="button"
            disabled={
              !selected || busy === 'activate' || (strategy === 'fusion' && !fusionModels.length)
            }
            onClick={activate}
          >
            {busy === 'activate' ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Check size={16} />
            )}{' '}
            Set active model
          </button>
        </div>
      </section>
      {providerModelModal && (
        <Modal
          title={`${providerNames[providerModelModal] || providerModelModal} models`}
          subtitle={
            providerModelModal === 'bluesminds'
              ? 'Choose a model ID returned for your BluesMinds key. “Use model” sets it as Relay’s active agent model; BluesMinds billing and access rules apply.'
              : 'Only models this API lists as free or with positive remaining quota are available to select.'
          }
          onClose={() => setProviderModelModal(null)}
          wide
        >
          {(() => {
            const routes = (catalog?.models || []).flatMap((model) =>
              model.providers.filter((provider) => provider.id === providerModelModal),
            );
            const providerState = catalog?.providers.find(
              (provider) => provider.providerId === providerModelModal,
            );
            const listedCount = providerState?.listedCount || 0;
            return routes.length ? (
              <div className="provider-model-picker">
                {routes.map((provider) => (
                  <button
                    className="provider-model-option"
                    type="button"
                    key={`${provider.id}::${provider.modelId}`}
                    onClick={() => void chooseProviderModel(provider)}
                    disabled={!!busy}
                  >
                    <span>
                      <strong>{provider.modelId}</strong>
                      <small>{provider.name}</small>
                    </span>
                    <span className="model-metric">
                      <small>Availability</small>
                      <strong>
                        {availabilityLabel(
                          provider.id,
                          provider.isFree,
                          provider.availableTokens,
                          provider.accountCreditsAvailable,
                        )}
                      </strong>
                    </span>
                    <span className="button small">
                      {busy === 'provider-model' ? 'Saving…' : 'Use model'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="model-empty">
                <KeyRound size={20} />
                <strong>
                  {listedCount
                    ? `${listedCount} models listed, none eligible yet`
                    : 'No eligible models returned'}
                </strong>
                <span>
                  {providerState?.error && listedCount > 0
                    ? `The model list returned, but the provider availability check failed: ${providerState.error}. Relay will not select models until it can confirm eligibility.`
                    : providerState?.error
                      ? `Provider check failed: ${providerState.error}`
                      : listedCount
                        ? 'The API returned model names, but none had explicit free access, positive per-model quota, positive account-credit metadata, or a documented Ollama free-usage allowance. Relay keeps them out of selection until an availability signal is found.'
                        : 'The provider key was saved, but no eligible models were returned. Check the key and provider access, then refresh.'}
                </span>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
