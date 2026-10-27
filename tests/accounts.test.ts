import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  hashAccountPassword,
  hashInviteToken,
  normalizeUsername,
  verifyAccountPassword,
} from '../lib/accounts';
import { unpersistedUsageThisMonth, rememberUnpersistedUsage } from '../lib/usage-memory';
import { canUserUseTarget } from '../lib/account-access';
import { hasAdminModelAssignment } from '../lib/provider-credentials';
import type { UserPrincipal } from '../lib/security';

test('usernames normalize consistently and reserve the owner login', () => {
  assert.equal(normalizeUsername('  Relay.User_7  '), 'relay.user_7');
  assert.throws(() => normalizeUsername('admin'));
  assert.throws(() => normalizeUsername('ab'));
  assert.throws(() => normalizeUsername('bad name'));
});

test('account passwords are salted, verified, and enforce minimum length', () => {
  const password = 'A-long-safe-password-123';
  const encoded = hashAccountPassword(password);
  assert.match(encoded, /^scrypt\$/);
  assert.notEqual(encoded, hashAccountPassword(password));
  assert.equal(verifyAccountPassword(password, encoded), true);
  assert.equal(verifyAccountPassword('incorrect-password', encoded), false);
  assert.throws(() => hashAccountPassword('too-short'));
});

test('invite tokens are stored as deterministic one-way SHA-256 digests', () => {
  const token = 'a-random-one-time-invite-token';
  const digest = hashInviteToken(token);
  assert.match(digest, /^[\da-f]{64}$/);
  assert.equal(hashInviteToken(token), digest);
  assert.notEqual(hashInviteToken(`${token}-other`), digest);
});

test('user model policy permits exact admin assignments and denies other managed models', async () => {
  const user: UserPrincipal = {
    id: 'account-user-test',
    role: 'user',
    username: 'member',
    email: 'member@example.com',
    plan: 'premium',
    providerMode: 'managed',
    monthlyTokenLimit: 20_000,
    allowedModels: [{ providerId: 'openrouter', modelId: 'vendor/model-a', name: 'Assigned A' }],
    enabled: true,
  };
  assert.equal(
    await canUserUseTarget(user, { providerId: 'openrouter', modelId: 'vendor/model-a' }),
    true,
  );
  assert.equal(
    await canUserUseTarget(user, { providerId: 'openrouter', modelId: 'vendor/model-b' }),
    false,
  );
});

test('admin credentials are authorized only for exact assigned provider-model pairs', () => {
  const assignments = [{ providerId: 'openrouter', modelId: 'vendor/model-a' }];
  assert.equal(
    hasAdminModelAssignment(assignments, { providerId: 'openrouter', modelId: 'vendor/model-a' }),
    true,
  );
  assert.equal(
    hasAdminModelAssignment(assignments, { providerId: 'openrouter', modelId: 'vendor/model-b' }),
    false,
  );
  assert.equal(
    hasAdminModelAssignment(assignments, { providerId: 'gemini', modelId: 'vendor/model-a' }),
    false,
  );
});

test('unpersisted token usage is account-scoped and ignores unknown provider usage', () => {
  const accountA = `usage-a-${randomUUID()}`;
  const accountB = `usage-b-${randomUUID()}`;
  rememberUnpersistedUsage(accountA, 120, 30);
  rememberUnpersistedUsage(accountA, null, 20);
  rememberUnpersistedUsage(accountB, 900, 100);
  assert.equal(unpersistedUsageThisMonth(accountA), 150);
  assert.equal(unpersistedUsageThisMonth(accountB), 1000);
});
