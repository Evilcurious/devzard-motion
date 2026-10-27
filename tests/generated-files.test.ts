import test from 'node:test';
import assert from 'node:assert/strict';
import { generatedFileBundleSchema } from '../lib/generated-files';
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
      files: [{ path: 'big.txt', content: 'x'.repeat(300_001) }],
    }).success,
    false,
  );
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
