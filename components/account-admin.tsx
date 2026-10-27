'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Link2,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRound,
  UserRoundX,
  X,
} from 'lucide-react';
import { api } from '@/lib/client-api';

type AvailableModel = { providerId: string; modelId: string; name: string; providerName: string };
type ManagedUser = {
  id: string;
  username: string;
  email: string | null;
  plan: 'free' | 'premium';
  modelAccess: 'all' | 'selected';
  enabled: boolean;
  providerMode: 'managed' | 'both';
  monthlyTokenLimit: number;
  allowedModels: Array<{ providerId: string; modelId: string; name: string }>;
  usedTokens: number;
  createdAt: string;
};
type AdminData = { users: ManagedUser[]; availableModels: AvailableModel[] };
type ModelSelection = {
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
};

export function AccountAdmin({ notify }: { notify: (message: string) => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'managed' | 'both'>('managed');
  const [limit, setLimit] = useState('100000');
  const [selected, setSelected] = useState<string[]>([]);
  const [accountSearch, setAccountSearch] = useState('');
  const [editingUserId, setEditingUserId] = useState('');
  const [editAccess, setEditAccess] = useState<'all' | 'selected'>('all');
  const [editSelected, setEditSelected] = useState<string[]>([]);
  const [inviteUrl, setInviteUrl] = useState('');
  const [activationEmail, setActivationEmail] = useState('');

  async function load() {
    try {
      setError('');
      setData(await api<AdminData>('/api/admin/users', undefined, 'GET'));
    } catch (caught) {
      setError((caught as Error).message || 'Could not load user accounts.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const query = accountSearch.trim().toLowerCase();
    return data.users.filter(
      (user) =>
        !query || `${user.email || ''} ${user.username} ${user.plan}`.toLowerCase().includes(query),
    );
  }, [data, accountSearch]);

  async function createInvite() {
    setBusy(true);
    setError('');
    setInviteUrl('');
    try {
      const monthlyTokenLimit = Number(limit);
      if (!Number.isSafeInteger(monthlyTokenLimit) || monthlyTokenLimit < 1000)
        throw new Error('Set a monthly token allowance of at least 1,000.');
      if (selected.length === 0)
        throw new Error('Select at least one admin-assigned model for this account.');
      const selectedModels =
        data?.availableModels.filter((model) =>
          selected.includes(`${model.providerId}::${model.modelId}`),
        ) || [];
      const result = await api<{ inviteUrl: string }>('/api/admin/users', {
        providerMode: mode,
        monthlyTokenLimit,
        allowedModels: selectedModels.map(({ providerId, modelId, name }) => ({
          providerId,
          modelId,
          name,
        })),
      });
      setInviteUrl(result.inviteUrl);
      await load();
      notify('One-time invitation link created.');
    } catch (caught) {
      setError((caught as Error).message || 'Could not create an invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleUser(user: ManagedUser) {
    try {
      await api(
        '/api/admin/users',
        { action: 'set-enabled', userId: user.id, enabled: !user.enabled },
        'PATCH',
      );
      await load();
      notify(user.enabled ? 'Account disabled.' : 'Account enabled.');
    } catch (caught) {
      setError((caught as Error).message || 'Could not update the account.');
    }
  }

  function startEditingModels(user: ManagedUser) {
    if (editingUserId === user.id) {
      setEditingUserId('');
      return;
    }
    setEditingUserId(user.id);
    setEditAccess(user.modelAccess);
    setEditSelected(user.allowedModels.map((model) => `${model.providerId}::${model.modelId}`));
  }

  async function savePremiumModels(user: ManagedUser) {
    setBusy(true);
    setError('');
    try {
      const allowedModels =
        editAccess === 'selected'
          ? data?.availableModels
              .filter((model) => editSelected.includes(`${model.providerId}::${model.modelId}`))
              .map(({ providerId, modelId, name }) => ({ providerId, modelId, name })) || []
          : [];
      await api(
        '/api/admin/users',
        {
          action: 'update-premium-models',
          userId: user.id,
          modelAccess: editAccess,
          allowedModels,
        },
        'PATCH',
      );
      setEditingUserId('');
      await load();
      notify(
        editAccess === 'all' ? 'All available models enabled.' : 'Premium model access updated.',
      );
    } catch (caught) {
      setError((caught as Error).message || 'Could not update Premium model access.');
    } finally {
      setBusy(false);
    }
  }

  async function activatePremium() {
    setBusy(true);
    setError('');
    try {
      const monthlyTokenLimit = Number(limit);
      if (!activationEmail.trim()) throw new Error('Enter the account email to activate.');
      if (!Number.isSafeInteger(monthlyTokenLimit) || monthlyTokenLimit < 1000)
        throw new Error('Set a monthly token allowance of at least 1,000.');
      await api(
        '/api/admin/users',
        {
          action: 'activate-premium',
          email: activationEmail.trim(),
          monthlyTokenLimit,
        },
        'PATCH',
      );
      setActivationEmail('');
      await load();
      notify('Premium activated. All available models and routing options are enabled.');
    } catch (caught) {
      setError((caught as Error).message || 'Could not activate Premium.');
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      notify('Invitation link copied.');
    } catch {
      notify('Copy was blocked by the browser. Select and copy the link below.');
    }
  }

  return (
    <div className="page-content account-admin-page">
      <div className="page-heading">
        <div className="eyebrow">ADMIN WORKSPACE</div>
        <h1>Accounts & invitations</h1>
        <p>
          Manage plans, Premium model access, token limits and invitations. Users’ personal keys and
          admin-managed credentials remain private.
        </p>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      <div className="account-admin-grid">
        <section className="account-admin-card">
          <div className="account-admin-title">
            <span>
              <Link2 size={17} />
            </span>
            <div>
              <h2>Legacy invitation</h2>
              <p>For existing invite-only account workflows.</p>
            </div>
          </div>
          <label className="settings-field">
            <span>Provider access</span>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as 'managed' | 'both')}
            >
              <option value="managed">Admin-assigned models only</option>
              <option value="both">Admin-assigned models + personal providers</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Monthly token allowance</span>
            <input
              type="number"
              min={1000}
              max={1000000000}
              step={1000}
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
            />
            <small>
              Only responses with provider-reported token usage are allowed for capped users.
            </small>
          </label>
          <ModelAccessPicker
            title="Allowed models"
            models={data?.availableModels || []}
            selected={selected}
            setSelected={setSelected}
          />
          {mode === 'both' && (
            <p className="settings-help">
              Users can also add and manage their own provider keys. Admin provider keys stay
              private.
            </p>
          )}
          <button className="button primary" disabled={busy || !data} onClick={createInvite}>
            {busy ? <LoaderCircle size={15} className="spin" /> : <Link2 size={15} />} Create
            one-time invitation
          </button>
          {inviteUrl && (
            <div className="invite-result">
              <label htmlFor="invite-url">Share this link once; it expires after 24 hours.</label>
              <div>
                <input id="invite-url" readOnly value={inviteUrl} />
                <button type="button" className="button" onClick={copyInvite}>
                  <Copy size={14} /> Copy
                </button>
              </div>
            </div>
          )}
          <div className="premium-activation">
            <h3>Activate Premium by email</h3>
            <p>
              Promote an existing Free account to all available models, routing modes and
              admin-managed storage.
            </p>
            <label className="settings-field">
              <span>Registered email</span>
              <input
                type="email"
                autoComplete="email"
                value={activationEmail}
                onChange={(event) => setActivationEmail(event.target.value)}
                placeholder="person@example.com"
              />
            </label>
            <small>
              Premium can use every currently available admin-managed model, choose any chat routing
              mode, and add personal provider keys. Admin credentials remain private. If a Free
              database is connected, Relay migrates account data without overwriting records.
            </small>
            <button className="button primary" disabled={busy || !data} onClick={activatePremium}>
              {busy ? <LoaderCircle size={15} className="spin" /> : <ShieldCheck size={15} />}
              Activate Premium
            </button>
          </div>
        </section>
        <section className="account-admin-card">
          <div className="account-admin-title">
            <span>
              <UserRound size={17} />
            </span>
            <div>
              <h2>User accounts</h2>
              <p>Emails, plan status and Premium usage, visible only to the admin.</p>
            </div>
          </div>
          <div className="managed-users-toolbar">
            <label className="managed-users-search">
              <span className="sr-only">Search accounts</span>
              <input
                type="search"
                placeholder="Search by email or username"
                value={accountSearch}
                onChange={(event) => setAccountSearch(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="button small"
              onClick={() => void load()}
              disabled={!data}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          {!data ? (
            <div className="settings-help">Loading accounts…</div>
          ) : filteredUsers.length ? (
            <div className="managed-users-list">
              {filteredUsers.map((user) => {
                const percent = user.monthlyTokenLimit
                  ? Math.min(100, (user.usedTokens / user.monthlyTokenLimit) * 100)
                  : 0;
                return (
                  <article className="managed-user" key={user.id}>
                    <div className="managed-user-head">
                      <div>
                        <strong>{user.email || user.username}</strong>
                        <span className={`small-badge ${user.plan === 'premium' ? 'green' : ''}`}>
                          {user.plan === 'premium' ? 'Premium' : 'Free'}
                        </span>
                        <span className={`small-badge ${user.enabled ? 'green' : ''}`}>
                          {user.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => void toggleUser(user)}
                      >
                        {user.enabled ? (
                          <>
                            <UserRoundX size={14} /> Disable
                          </>
                        ) : (
                          <>
                            <Check size={14} /> Enable
                          </>
                        )}
                      </button>
                    </div>
                    <div className="managed-user-meta">
                      {user.plan === 'premium'
                        ? `${user.modelAccess === 'all' ? 'All available models' : `${user.allowedModels.length} selected model${user.allowedModels.length === 1 ? '' : 's'}`} · ${user.monthlyTokenLimit.toLocaleString()} monthly tokens`
                        : 'Own PostgreSQL database and provider keys'}
                    </div>
                    {user.plan === 'premium' && (
                      <button
                        type="button"
                        className="button small managed-user-edit"
                        onClick={() => startEditingModels(user)}
                      >
                        {editingUserId === user.id ? <X size={14} /> : <Pencil size={14} />}
                        {editingUserId === user.id ? 'Close model editor' : 'Edit models'}
                      </button>
                    )}
                    {user.plan === 'premium' && editingUserId === user.id && (
                      <div className="premium-model-editor">
                        <label className="settings-field">
                          <span>Premium model access</span>
                          <select
                            value={editAccess}
                            onChange={(event) =>
                              setEditAccess(event.target.value as 'all' | 'selected')
                            }
                          >
                            <option value="all">All available models</option>
                            <option value="selected">Only selected admin-managed models</option>
                          </select>
                          <small>
                            Personal provider keys remain available in either mode. Admin
                            credentials are used only for all models or explicitly assigned models.
                          </small>
                        </label>
                        {editAccess === 'selected' && (
                          <ModelAccessPicker
                            title="Selected admin-managed models"
                            models={data?.availableModels || []}
                            selected={editSelected}
                            setSelected={setEditSelected}
                          />
                        )}
                        <div className="premium-model-editor-actions">
                          <button
                            type="button"
                            className="button primary"
                            disabled={busy || (editAccess === 'selected' && !editSelected.length)}
                            onClick={() => void savePremiumModels(user)}
                          >
                            {busy ? (
                              <LoaderCircle size={14} className="spin" />
                            ) : (
                              <Save size={14} />
                            )}
                            Save model access
                          </button>
                          <button
                            type="button"
                            className="button small"
                            onClick={() => setEditingUserId('')}
                            disabled={busy}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {user.plan === 'premium' && (
                      <>
                        <div className="quota-meter">
                          <span style={{ width: `${percent}%` }} />
                        </div>
                        <div className="managed-user-usage">
                          {user.usedTokens.toLocaleString()} /{' '}
                          {user.monthlyTokenLimit.toLocaleString()} tokens this month
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          ) : data.users.length ? (
            <div className="settings-help">No accounts match this search.</div>
          ) : (
            <div className="settings-help">
              No user accounts yet. Create an invitation to get started.
            </div>
          )}
          {!data?.availableModels.length && (
            <div className="account-admin-note">
              <ShieldCheck size={15} /> No eligible models are currently available for assignment.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ModelAccessPicker({
  title,
  models,
  selected,
  setSelected,
}: ModelSelection & { title: string; models: AvailableModel[] }) {
  const [providerFilter, setProviderFilter] = useState('*');
  const [query, setQuery] = useState('');
  const providerOptions = useMemo(
    () =>
      [...new Map(models.map((model) => [model.providerId, model.providerName])).entries()].sort(
        ([, a], [, b]) => a.localeCompare(b),
      ),
    [models],
  );
  const visibleModels = useMemo(() => {
    const search = query.trim().toLowerCase();
    return models.filter(
      (model) =>
        (providerFilter === '*' || model.providerId === providerFilter) &&
        (!search ||
          `${model.name} ${model.modelId} ${model.providerName}`.toLowerCase().includes(search)),
    );
  }, [models, providerFilter, query]);
  const keysForProvider =
    providerFilter === '*'
      ? []
      : models
          .filter((model) => model.providerId === providerFilter)
          .map((model) => `${model.providerId}::${model.modelId}`);

  return (
    <div className="account-model-picker">
      <div className="account-model-picker-head">
        <div>
          <strong>{title}</strong>
          <small>
            {selected.length.toLocaleString()} selected · {models.length.toLocaleString()} available
          </small>
        </div>
        <input
          aria-label={`Search ${title.toLowerCase()}`}
          placeholder="Search models"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="account-model-tools">
        <label>
          <span>Provider</span>
          <select
            aria-label="Filter models by provider"
            value={providerFilter}
            onChange={(event) => setProviderFilter(event.target.value)}
          >
            <option value="*">All providers</option>
            {providerOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="account-model-actions">
          <button
            type="button"
            className="button small"
            onClick={() =>
              setSelected([
                ...new Set(models.map((model) => `${model.providerId}::${model.modelId}`)),
              ])
            }
            disabled={!models.length}
          >
            Select all
          </button>
          <button
            type="button"
            className="button small"
            onClick={() => setSelected((items) => [...new Set([...items, ...keysForProvider])])}
            disabled={!keysForProvider.length}
          >
            Select provider’s models
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => setSelected([])}
            disabled={!selected.length}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="account-model-options">
        {visibleModels.map((model) => {
          const key = `${model.providerId}::${model.modelId}`;
          const checked = selected.includes(key);
          return (
            <label key={key} className="account-model-option">
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setSelected((items) =>
                    checked ? items.filter((item) => item !== key) : [...items, key],
                  )
                }
              />
              <span>
                <strong>{model.name}</strong>
                <small>
                  {model.providerName} · {model.modelId}
                </small>
              </span>
            </label>
          );
        })}
        {!visibleModels.length && (
          <p className="settings-help">No currently eligible models match these filters.</p>
        )}
      </div>
    </div>
  );
}
