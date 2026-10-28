import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findHtmlPreviewFile,
  generatedArtifactSchema,
  generatedFileBundleSchema,
} from '../lib/generated-files';
import { createZip } from '../lib/zip';

test('generated bundles accept safe source files and website previews', () => {
  const parsed = generatedFileBundleSchema.parse({
    name: 'tiny-site',
    files: [
      { path: 'index.html', content: '<!doctype html><h1>Hello</h1>' },
      { path: 'README.md', content: 'Open index.html in a browser.' },
    ],
  });
  assert.equal(parsed.files.length, 2);
});

test('preview artifact schema accepts the generated artifact ID sent by the browser', () => {
  const artifact = generatedArtifactSchema.parse({
    id: 'generated-artifact-1',
    name: 'tiny-site',
    files: [{ path: 'index.html', content: '<h1>Hello</h1>' }],
  });
  assert.equal(artifact.id, 'generated-artifact-1');
});

test('Node.js and Python project sources are preserved in the downloadable ZIP', () => {
  const projectFiles = [
    { path: 'package.json', content: '{"scripts":{"start":"node server.js"}}' },
    { path: 'server.js', content: "import express from 'express';" },
    { path: 'requirements.txt', content: 'flask==3.0.0' },
    { path: 'app.py', content: 'from flask import Flask\\napp = Flask(__name__)' },
    { path: 'README.md', content: 'Install dependencies, then run the app.' },
  ];
  const parsed = generatedFileBundleSchema.parse({ name: 'full-stack-app', files: projectFiles });
  const archive = createZip(parsed.files);
  const archiveText = new TextDecoder().decode(archive);

  for (const file of projectFiles) {
    assert.ok(archiveText.includes(file.path), `${file.path} should be included in the ZIP`);
    assert.ok(archiveText.includes(file.content), `${file.path} source should be preserved`);
  }
});

test('generated bundles reject traversal, secret paths, duplicates, and oversized content', () => {
  for (const path of [
    '../escape.txt',
    '/absolute.txt',
    'C:/drive.txt',
    '.env',
    'keys/private.pem',
  ]) {
    assert.equal(
      generatedFileBundleSchema.safeParse({ name: 'bad', files: [{ path, content: 'x' }] }).success,
      false,
      `${path} should be rejected`,
    );
  }
  assert.equal(
    generatedFileBundleSchema.safeParse({
      name: 'duplicate',
      files: [
        { path: 'index.html', content: 'a' },
        { path: 'INDEX.HTML', content: 'b' },
      ],
    }).success,
    false,
  );
  assert.equal(
    generatedFileBundleSchema.safeParse({
      name: 'large',
      files: [{ path: 'big.txt', content: 'x'.repeat(500_001) }],
    }).success,
    false,
  );
});

test('larger projects support 100 source files and totals above the former 300 KB limit', () => {
  const files = Array.from({ length: 40 }, (_, index) => ({
    path: `src/module-${index}.txt`,
    content: 'x'.repeat(10_000),
  }));
  assert.equal(
    generatedFileBundleSchema.safeParse({ name: 'larger-project', files }).success,
    true,
  );
  assert.equal(
    generatedFileBundleSchema.safeParse({
      name: 'too-many-files',
      files: Array.from({ length: 101 }, (_, index) => ({ path: `f-${index}.txt`, content: '' })),
    }).success,
    false,
  );
  assert.equal(
    generatedFileBundleSchema.safeParse({
      name: 'too-large',
      files: [{ path: 'big.txt', content: 'x'.repeat(1_500_001) }],
    }).success,
    false,
  );
});

test('HTML preview selection prefers root or nested index.html, then any HTML file', () => {
  const files = [
    { path: 'pages/demo.html', content: '<h1>Demo</h1>' },
    { path: 'site/index.html', content: '<h1>Site</h1>' },
  ];
  assert.equal(findHtmlPreviewFile(files)?.path, 'site/index.html');
  assert.equal(
    findHtmlPreviewFile([{ path: 'preview.htm', content: '<h1>Preview</h1>' }])?.path,
    'preview.htm',
  );
  assert.equal(findHtmlPreviewFile([{ path: 'README.md', content: 'No preview' }]), undefined);
});

test('ZIP writer creates valid UTF-8 stored entries with a central directory', () => {
  const archive = createZip([
    { path: 'index.html', content: '<h1>Preview ✓</h1>' },
    { path: 'src/app.js', content: 'console.log("hello")' },
  ]);
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint16(6, true), 0x0800);
  const nameLength = view.getUint16(26, true);
  const contentLength = view.getUint32(22, true);
  assert.equal(new TextDecoder().decode(archive.subarray(30, 30 + nameLength)), 'index.html');
  assert.equal(
    new TextDecoder().decode(archive.subarray(30 + nameLength, 30 + nameLength + contentLength)),
    '<h1>Preview ✓</h1>',
  );
  let endOffset = archive.length - 22;
  while (endOffset > 0 && view.getUint32(endOffset, true) !== 0x06054b50) endOffset--;
  assert.ok(endOffset > 0, 'ZIP end-of-central-directory record should exist');
  assert.equal(view.getUint16(endOffset + 10, true), 2);
});
