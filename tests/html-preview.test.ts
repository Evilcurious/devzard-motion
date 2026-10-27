import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSandboxedPreviewDocument,
  findPreviewBuildEntries,
  resolvePreviewFilePath,
} from '../lib/html-preview';

test('React and TypeScript preview entries resolve from local HTML script and stylesheet references', () => {
  const files = [
    { path: 'site/index.html', content: '' },
    { path: 'site/src/main.tsx', content: 'import App from "./App";' },
    { path: 'site/src/App.tsx', content: 'export default function App() {}' },
    { path: 'site/src/site.css', content: 'body { color: teal; }' },
  ];
  const entries = findPreviewBuildEntries(
    'site/index.html',
    '<html><head><link rel="stylesheet" href="./src/site.css"></head><body><div id="root"></div><script type="module" src="./src/main.tsx"></script></body></html>',
    files,
  );
  assert.equal(entries.script, 'site/src/main.tsx');
  assert.deepEqual(entries.stylesheets, ['site/src/site.css']);
});

test('preview build paths stay within the generated bundle', () => {
  assert.equal(resolvePreviewFilePath('site/index.html', '../src/main.tsx'), 'src/main.tsx');
  assert.equal(resolvePreviewFilePath('site/index.html', '../../outside.ts'), null);
  assert.equal(resolvePreviewFilePath('index.html', 'https://example.com/app.css'), null);
  assert.equal(resolvePreviewFilePath('index.html', '/src/main.tsx'), 'src/main.tsx');
});

test('preview documents inline CSS and compiled JavaScript while keeping network access blocked', () => {
  const document = buildSandboxedPreviewDocument(
    '<!doctype html><html><head><link rel="stylesheet" href="./src/app.css"></head><body><div id="root"></div><script type="module" src="./src/main.tsx"></script></body></html>',
    'body { color: teal; }',
    'window.previewReady = true;',
  );
  assert.match(document, /Content-Security-Policy/);
  assert.match(document, /connect-src &#39;none&#39;|connect-src 'none'/);
  assert.match(document, /<style>body \{ color: teal; \}<\/style>/);
  assert.match(document, /<script>window\.previewReady = true;<\/script>/);
  assert.doesNotMatch(document, /src="\.\/src\/main\.tsx"/);
  assert.doesNotMatch(document, /href="\.\/src\/app\.css"/);
});
