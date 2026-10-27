'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Link2, LoaderCircle, ShieldCheck, UserRound, UserRoundX } from 'lucide-react';
import { api } from '@/lib/client-api';

type AvailableModel = { providerId: string; modelId: string; name: string; providerName: string };
type ManagedUser = {
  id: string;
  username: string;
  email: string | null;
  plan: 'free' | 'premium';
  enabled: boolean;
  providerMode: 'managed' | 'both';
  monthlyTokenLimit: number;
  allowedModels: Array<{ providerId: string; modelId: string; name: string }>;
  usedTokens: number;
  createdAt: string;
};
type AdminData = { users: ManagedUser[]; availableModels: AvailableModel[] };

export function AccountAdmin({ notify }: { notify: (message: string) => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'managed' | 'both'>('managed');
  const [limit, setLimit] = useState('100000');
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
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

  const available = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    return data.availableModels.filter(
      (model) =>
        !query ||
        `${model.name} ${model.modelId} ${model.providerName}`.toLowerCase().includes(query),
    );
  }, [data, search]);

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

  async function activatePremium() {
    setBusy(true);
    setError('');
    try {
      const monthlyTokenLimit = Number(limit);
      if (!activationEmail.trim()) throw new Error('Enter the account email to activate.');
      if (!Number.isSafeInteger(monthlyTokenLimit) || monthlyTokenLimit < 1000)
        throw new Error('Set a monthly token allowance of at least 1,000.');
      if (selected.length === 0)
        throw new Error('Select at least one admin-assigned model for Premium.');
      const selectedModels =
        data?.availableModels.filter((model) =>
          selected.includes(`${model.providerId}::${model.modelId}`),
        ) || [];
      await api(
        '/api/admin/users',
        {
          action: 'activate-premium',
          email: activationEmail.trim(),
          monthlyTokenLimit,
          allowedModels: selectedModels.map(({ providerId, modelId, name }) => ({
            providerId,
            modelId,
            name,
          })),
        },
        'PATCH',
      );
      setActivationEmail('');
      await load();
      notify('Premium activated. Assigned models are ready for this account.');
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
          Free accounts use their own PostgreSQL database and provider keys; activate Premium for
          shared admin-managed models.
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
          <div className="account-model-picker">
            <div className="account-model-picker-head">
              <div>
                <strong>Allowed models</strong>
                <small>{selected.length} selected</small>
              </div>
              <input
                aria-label="Search allowed models"
                placeholder="Search models"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="account-model-options">
              {available.map((model) => {
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
              {!available.length && (
                <p className="settings-help">
                  No currently eligible models match this search. Connect an admin provider and
                  refresh the model catalog.
                </p>
              )}
            </div>
            {mode === 'both' && (
              <p className="settings-help">
                Users can also add and manage their own provider keys. Admin provider keys stay
                private.
              </p>
            )}
          </div>
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
            <p>Promote an existing Free account to admin-managed models and storage.</p>
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
              Premium uses Relay’s private database and assigned provider models. If a Free database
              is connected, Relay migrates the account’s data without overwriting existing records.
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
          {!data ? (
            <div className="settings-help">Loading accounts…</div>
          ) : data.users.length ? (
            <div className="managed-users-list">
              {data.users.map((user) => {
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
                        ? `${user.allowedModels.length} admin-assigned model${user.allowedModels.length === 1 ? '' : 's'} · ${user.monthlyTokenLimit.toLocaleString()} monthly tokens`
                        : 'Own PostgreSQL database and provider keys'}
                    </div>
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
