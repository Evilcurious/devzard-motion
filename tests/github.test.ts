import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGitHubCommitMessage, validateGitHubFiles } from '../lib/github';
import { toolsForConnections } from '../lib/tools';

test('GitHub code proposals accept bounded, unique repository-relative text files', () => {
  assert.deepEqual(
    validateGitHubFiles([
      { path: 'package.json', content: '{"name":"sample"}' },
      { path: 'src/app/page.tsx', content: 'export default function Page() {}' },
      { path: '.env.example', content: 'PUBLIC_API_URL=' },
    ]).map((file) => file.path),
    ['package.json', 'src/app/page.tsx', '.env.example'],
  );
});

test('GitHub code proposals reject traversal, workflows, secrets, duplicates and oversize input', () => {
  for (const path of [
    '../outside.txt',
    '/absolute.txt',
    '.git/config',
    '.github/workflows/deploy.yml',
    '.env',
    '.env.production',
    'private.pem',
    'a\\..\\b.txt',
  ]) {
    assert.throws(() => validateGitHubFiles([{ path, content: 'x' }]), /invalid path|not allowed/i);
  }
  assert.throws(
    () =>
      validateGitHubFiles([
        { path: 'same.txt', content: '' },
        { path: 'same.txt', content: '' },
      ]),
    /duplicate/i,
  );
  assert.throws(
    () => validateGitHubFiles([{ path: 'large.txt', content: 'x'.repeat(100_001) }]),
    /too large/i,
  );
  assert.throws(
    () =>
      validateGitHubFiles(
        Array.from({ length: 31 }, (_, i) => ({ path: `${i}.txt`, content: '' })),
      ),
    /between 1 and 30/i,
  );
});

test('chat receives only integration tools that the user has connected', () => {
  assert.deepEqual(toolsForConnections(false, false), []);
  assert.deepEqual(
    toolsForConnections(false, false, true).map((tool) => tool.function.name),
    ['list_vercel_projects', 'list_vercel_deployments'],
  );
  assert.deepEqual(
    toolsForConnections(true, false).map((tool) => tool.function.name),
    ['search_emails', 'read_email', 'send_email', 'append_to_sheet'],
  );
  assert.deepEqual(
    toolsForConnections(false, true).map((tool) => tool.function.name),
    ['github_push_files'],
  );
});

test('GitHub commit messages are a bounded single line', () => {
  assert.equal(
    validateGitHubCommitMessage('Add a polished landing page'),
    'Add a polished landing page',
  );
  assert.throws(() => validateGitHubCommitMessage('line one\nline two'), /one line/i);
  assert.throws(() => validateGitHubCommitMessage(' '), /one line/i);
  assert.throws(() => validateGitHubCommitMessage('x'.repeat(121)), /1–120/i);
});
