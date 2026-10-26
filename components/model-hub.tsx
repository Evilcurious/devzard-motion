'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client-api';
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
  docsURL: string;
  note: string | null;
};
type ModelProvider = {
  id: string;
  name: string;
  modelId: string;
  contextTokens: number | null;
  availableTokens: number | null;
  supportsTools: boolean | null;
};
type Model = {
  key: string;
  id: string;
  name: string;
  providers: ModelProvider[];
  contextTokens: number | null;
  availableTokens: number | null;
};
type Strategy = 'manual' | 'fallback' | 'fusion';
type Target = { providerId: string; modelId: string };
type Catalog = {
  models: Model[];
  providers: Array<{ providerId: string; modelCount: number; error: string | null }>;
  refreshedAt: string;
  metricsNote: string;
};

const providerNames: Record<string, string> = {
  openrouter: 'OpenRouter',
  'ollama-cloud': 'Ollama Cloud',
  kilo: 'Kilo Gateway',
  ovh: 'OVH AI Endpoints',
  agnes: 'Agnes AI',
  routeway: 'Routeway',
  bazaarlink: 'BazaarLink',
  requesty: 'Requesty',
  aihorde: 'AI Horde',
  firecrawl: 'Firecrawl',
  parallel: 'Parallel',
  keenable: 'KeenAble',
};
const targetKey = (target: Target) => `${target.providerId}::${target.modelId}`;
const formatTokens = (n: number | null) =>
  n === null ? 'Not reported' : `${n.toLocaleString()} tokens`;

export function ModelHub({
  onSelect,
  notify,
}: {
  onSelect: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selection, setSelection] = useState<Target | null>(null);
  const [strategy, setStrategy] = useState<Strategy>('manual');
  const [fallbacks, setFallbacks] = useState<Target[]>([]);
  const [fusionModels, setFusionModels] = useState<Target[]>([]);
  const [connectId, setConnectId] = useState('');
  const [key, setKey] = useState('');
  const [quickProviderId, setQuickProviderId] = useState('openrouter');
  const [quickKey, setQuickKey] = useState('');
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState<'all' | 'models' | 'search'>('all');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const selected =
    selection ||
    (catalog?.models[0]?.providers[0]
      ? {
          providerId: catalog.models[0].providers[0].id,
          modelId: catalog.models[0].providers[0].modelId,
        }
      : null);

  async function loadProviders() {
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
  }
  async function loadSelection() {
    const response = await api<{
      selection: null | {
        providerId: string;
        modelId: string;
        strategy: Strategy;
        fallbackChain: Target[];
        fusionModels: Target[];
      };
    }>('/api/router/selection', undefined, 'GET');
    if (response.selection) {
      setSelection({
        providerId: response.selection.providerId,
        modelId: response.selection.modelId,
      });
      setStrategy(
        response.selection.strategy === 'fallback' || response.selection.strategy === 'fusion'
          ? response.selection.strategy
          : 'manual',
      );
      setFallbacks(response.selection.fallbackChain || []);
      setFusionModels(response.selection.fusionModels || []);
    }
    return response.selection;
  }
  async function discover(autoSelect = false) {
    setBusy('discover');
    setError('');
    try {
      const result = await api<Catalog>('/api/router/models', undefined, 'GET');
      setCatalog(result);
      if (autoSelect && !selection && result.models[0]?.providers[0]) {
        setSelection({
          providerId: result.models[0].providers[0].id,
          modelId: result.models[0].providers[0].modelId,
        });
      }
    } catch (e) {
      setError((e as Error).message);
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
      await loadProviders();
      await discover();
      notify(`${providerNames[providerId] || providerId} connection saved securely.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function removeProvider(providerId: string) {
    setBusy(providerId);
    setError('');
    try {
      await api('/api/router/providers', { providerId }, 'DELETE');
      if (selection?.providerId === providerId) {
        setSelection(null);
        setStrategy('manual');
      }
      setFallbacks((items) => items.filter((target) => target.providerId !== providerId));
      setFusionModels((items) => items.filter((target) => target.providerId !== providerId));
      await loadProviders();
      await discover();
      notify(`${providerNames[providerId] || providerId} connection removed.`);
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
        ...selected,
        strategy,
        fallbackChain: strategy === 'fallback' ? fallbacks : [],
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
    else if (list.length < max) setList([...list, target]);
  }

  const visibleProviders = providers.filter((p) => category === 'all' || p.category === category);
  const visibleModels = useMemo(
    () =>
      (catalog?.models || []).filter((model) => {
        const haystack =
          `${model.name} ${model.id} ${model.providers.map((p) => p.name).join(' ')}`.toLowerCase();
        return haystack.includes(filter.toLowerCase());
      }),
    [catalog, filter],
  );
  const providerErrors = catalog?.providers.filter((provider) => provider.error) || [];
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
            Search credentials are encrypted for future integration; this provider is not called by
            Relay yet.
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
                          : `${state?.modelCount ?? '…'} models`
                        : 'Not connected'}
                  </span>
                </div>
                <h3>{provider.name}</h3>
                <p>
                  {provider.category === 'models' ? 'Chat model provider' : 'Search integration'}
                </p>
                {provider.note && <small className="provider-note">{provider.note}</small>}
                {provider.category === 'models' && state?.error && (
                  <small className="provider-note error-text">{state.error}</small>
                )}
                <div className="provider-card-actions">
                  {provider.keyRequired && provider.keySaved ? (
                    <span className="key-saved">
                      <ShieldCheck size={14} /> Encrypted key saved
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
                      {provider.keySaved ? (
                        <button
                          className="text-button danger-text"
                          onClick={() => removeProvider(provider.id)}
                          disabled={busy === provider.id}
                        >
                          <Trash2 size={14} /> Remove key
                        </button>
                      ) : null}
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
        <div className="model-tools">
          <label className="model-search">
            <Search size={16} />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search models or providers"
            />
          </label>
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
                  onClick={() =>
                    setSelection({
                      providerId: model.providers[0].id,
                      modelId: model.providers[0].modelId,
                    })
                  }
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
                    <small>Account quota</small>
                    <strong>{formatTokens(model.availableTokens)}</strong>
                  </span>
                  <span className="model-check">
                    {selected &&
                      model.providers.some(
                        (p) => p.id === selected.providerId && p.modelId === selected.modelId,
                      ) && <Check size={16} />}
                  </span>
                </button>
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
                        onClick={() => setSelection({ providerId: p.id, modelId: p.modelId })}
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
            <KeyRound size={20} />
            <strong>No models discovered yet</strong>
            <span>
              Add provider keys above, then refresh. Some providers may require authentication
              before listing models.
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
            Reliability, speed, intelligence, and guardrail ratings are not available as measured
            data here. Relay shows live model-list connectivity and provider-reported limits only.
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
        <p className="model-hub-copy">
          Primary model:{' '}
          <strong>
            {selected
              ? `${selected.modelId} · ${providerNames[selected.providerId] || selected.providerId}`
              : 'Select a model above'}
          </strong>
        </p>
        <div className="strategy-grid">
          {(
            [
              ['manual', 'Manual', 'Use the selected model for every request.'],
              ['fallback', 'Fallback chain', 'Try backup models if the selected provider fails.'],
              [
                'fusion',
                'Fusion',
                'Ask multiple models, then synthesize their answers. Tools and approval actions are disabled in fusion mode.',
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
        {strategy !== 'manual' && (
          <div className="route-candidates">
            <label>
              {strategy === 'fallback' ? 'Fallback models (in order)' : 'Fusion models (up to 4)'}
            </label>
            <div className="route-model-options">
              {(catalog?.models || []).flatMap((model) =>
                model.providers.map((provider) => {
                  const target = { providerId: provider.id, modelId: provider.modelId };
                  const activeList = strategy === 'fallback' ? fallbacks : fusionModels;
                  const limit = strategy === 'fallback' ? 8 : 4;
                  const checked = activeList.some((item) => targetKey(item) === targetKey(target));
                  return (
                    <label key={targetKey(target)}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={
                          (!checked && activeList.length >= limit) ||
                          targetKey(target) === (selected ? targetKey(selected) : '')
                        }
                        onChange={() =>
                          toggleTarget(
                            activeList,
                            strategy === 'fallback' ? setFallbacks : setFusionModels,
                            target,
                            limit,
                          )
                        }
                      />
                      <span>{provider.name}</span>
                      <small>{provider.modelId}</small>
                    </label>
                  );
                }),
              )}
            </div>
            {strategy === 'fallback' && fallbacks.length > 0 && (
              <small>
                Fallback order is the order selected below; reorder by removing and adding models
                again.
              </small>
            )}
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
              !selected ||
              busy === 'activate' ||
              (strategy === 'fallback' && !fallbacks.length) ||
              (strategy === 'fusion' && !fusionModels.length)
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
    </div>
  );
}
