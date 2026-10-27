import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptSecret, decryptSecret } from '../lib/secrets';
import { validateEndpoint } from '../lib/endpoint';
import { workspaceSchema } from '../lib/workspace-data';
import { themes, isTheme } from '../lib/themes';

test('database credentials are encrypted, bound to their purpose and reject tampering', () => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'unit-test-secret-with-at-least-32-characters';
  try {
    const value = { key: 'test-key-not-a-real-credential', model: 'test-model' };
    const encrypted = encryptSecret(value, 'model');
    assert.ok(!encrypted.includes(value.key));
    assert.deepEqual(decryptSecret(encrypted, 'model'), value);
    assert.throws(() => decryptSecret(encrypted, 'google'));
    const body = Buffer.from(encrypted.slice(3), 'base64url');
    body[30] ^= 1;
    assert.throws(() => decryptSecret('v1.' + body.toString('base64url'), 'model'));
    process.env.SESSION_SECRET = 'changed-secret-with-at-least-32-characters';
    assert.throws(() => decryptSecret(encrypted, 'model'));
    process.env.SESSION_SECRET = '';
    assert.throws(() => encryptSecret(value, 'model'), /setup/);
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  }
});

test('editable endpoints require an exact allowed origin and no embedded credentials', () => {
  assert.equal(validateEndpoint('http://localhost:11434/v1/'), 'http://localhost:11434/v1');
  assert.equal(validateEndpoint('https://api.openai.com/v1'), 'https://api.openai.com/v1');
  assert.throws(() => validateEndpoint('http://169.254.169.254/latest/meta-data'));
  assert.throws(() => validateEndpoint('https://api.openai.com.attacker.invalid/v1'));
  assert.throws(() => validateEndpoint('https://user:secret@api.openai.com/v1'));
  assert.throws(() => validateEndpoint('https://api.openai.com/v1?api_key=secret'));
  const previous = process.env.AI_ALLOWED_ORIGINS;
  process.env.AI_ALLOWED_ORIGINS = 'https://my-provider.example';
  try {
    assert.equal(
      validateEndpoint('https://my-provider.example/v1'),
      'https://my-provider.example/v1',
    );
  } finally {
    if (previous === undefined) delete process.env.AI_ALLOWED_ORIGINS;
    else process.env.AI_ALLOWED_ORIGINS = previous;
  }
});

test('workspace persistence strips approval tokens and rejects malformed messages', () => {
  const data = {
    conversations: [
      {
        id: 'conversation',
        title: 'A chat',
        updated: new Date().toISOString(),
        messages: [
          {
            id: 'message',
            role: 'assistant',
            content: 'Review this email.',
            artifacts: [
              {
                id: 'artifact',
                name: 'tiny-site',
                files: [{ path: 'index.html', content: '<!doctype html><h1>Hello</h1>' }],
              },
            ],
            media: {
              type: 'image',
              urls: ['https://cdn.example.com/generated.png'],
              providerName: 'xKiro',
              modelId: 'sensenova/sensenova-u1.5-lite',
            },
            sources: [
              {
                title: 'Example source',
                url: 'https://example.com/article',
                snippet: 'A sample source excerpt.',
              },
            ],
            proposals: [
              {
                id: 'action',
                name: 'send_email',
                args: { to: 'alice@example.com', subject: 'Test', body: 'Test only' },
                token: 'must-never-be-stored',
              },
              {
                id: 'github-action',
                name: 'github_push_files',
                repository: {
                  id: 123,
                  fullName: 'relay-owner/site',
                  defaultBranch: 'main',
                  htmlUrl: 'https://github.com/relay-owner/site',
                },
                args: {
                  commitMessage: 'Add a website',
                  files: [{ path: 'package.json', content: '{"name":"site"}' }],
                },
                token: 'github-token-must-not-be-stored',
              },
            ],
          },
        ],
      },
    ],
    activities: [],
    workflows: [],
    theme: 'blue',
  };
  const result = workspaceSchema.parse(data);
  assert.equal(result.conversations[0].messages[0].proposals?.[0].token, '');
  assert.equal(result.conversations[0].messages[0].proposals?.[1].token, '');
  assert.equal(
    (result.conversations[0].messages[0].proposals?.[1] as { args?: { files?: unknown[] } })?.args
      ?.files?.length,
    1,
  );
  assert.equal(
    result.conversations[0].messages[0].media?.urls[0],
    'https://cdn.example.com/generated.png',
  );
  assert.equal(result.conversations[0].messages[0].sources?.[0].title, 'Example source');
  assert.equal(result.conversations[0].messages[0].artifacts?.[0].files[0].path, 'index.html');
  assert.equal(result.theme, 'blue');
  assert.equal(workspaceSchema.parse({ ...data, theme: 'dark' }).theme, 'dark');
  assert.equal(workspaceSchema.safeParse({ ...data, theme: 'unknown' }).success, false);
  assert.equal(
    workspaceSchema.safeParse({
      ...data,
      conversations: [
        { ...data.conversations[0], messages: [{ role: 'system', content: 'unsafe role' }] },
      ],
    }).success,
    false,
  );
});

test('light, dark and accent themes are supported', () => {
  assert.deepEqual(
    themes.map((theme) => theme.id),
    ['light', 'dark', 'green', 'forest', 'black', 'red', 'blue', 'yellow', 'gold'],
  );
  for (const theme of themes) assert.ok(isTheme(theme.id));
  assert.equal(isTheme('purple'), false);
});
