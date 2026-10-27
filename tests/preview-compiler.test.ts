import test from 'node:test';
import assert from 'node:assert/strict';
import { compilePreviewProject } from '../lib/preview-compiler';

test('preview compiler bundles React TSX, local TypeScript modules, and CSS in memory', async () => {
  const output = await compilePreviewProject(
    [
      {
        path: 'index.html',
        content:
          '<!doctype html><html><head><link rel="stylesheet" href="/src/site.css"></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
      },
      {
        path: 'src/main.tsx',
        content: [
          "import React from 'react';",
          "import { createRoot } from 'react-dom/client';",
          "import App from './App';",
          "import './site.css';",
          "createRoot(document.getElementById('root')!).render(<App />);",
        ].join('\n'),
      },
      {
        path: 'src/App.tsx',
        content: 'export default function App(): JSX.Element { return <h1>Preview works</h1>; }',
      },
      { path: 'src/site.css', content: 'body { color: teal; } h1 { font-weight: 600; }' },
    ],
    'index.html',
  );

  assert.match(output.javascript, /Preview works/);
  assert.match(output.javascript, /createRoot|hydrateRoot/);
  assert.match(output.css, /color:teal/);
  assert.match(output.css, /font-weight:600/);
});

test('preview compiler rejects network and non-React package imports', async () => {
  await assert.rejects(
    compilePreviewProject(
      [
        {
          path: 'index.html',
          content: '<div id="root"></div><script type="module" src="/src/main.tsx"></script>',
        },
        {
          path: 'src/main.tsx',
          content: "import 'node:fs'; console.log('must not bundle a server module');",
        },
      ],
      'index.html',
    ),
  );
});
