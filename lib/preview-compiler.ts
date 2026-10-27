import path from 'node:path';
import { build } from 'esbuild';
import type { GeneratedFile } from './generated-files';
import { findPreviewBuildEntries } from './html-preview';

const virtualEntry = '__relay_preview_entry__.tsx';
const reactImport = /^react(?:-dom(?:\/client)?|\/(?:jsx-runtime|jsx-dev-runtime))?$/;
const assetLoaders: Record<string, 'dataurl'> = {
  '.gif': 'dataurl',
  '.jpeg': 'dataurl',
  '.jpg': 'dataurl',
  '.png': 'dataurl',
  '.svg': 'dataurl',
  '.webp': 'dataurl',
  '.woff': 'dataurl',
  '.woff2': 'dataurl',
  '.ttf': 'dataurl',
  '.otf': 'dataurl',
};

function resolveProjectFile(reference: string, importer: string, files: Map<string, string>) {
  const cleanReference = reference.split(/[?#]/, 1)[0];
  const normalized = path.posix.normalize(
    cleanReference.startsWith('/') || cleanReference.startsWith('@/')
      ? cleanReference.replace(/^\/?@?\/?/, '')
      : path.posix.join(path.posix.dirname(importer), cleanReference),
  );
  if (!normalized || normalized === '..' || normalized.startsWith('../')) return null;

  const extension = path.posix.extname(normalized);
  const candidates = extension
    ? [normalized]
    : [
        `${normalized}.tsx`,
        `${normalized}.ts`,
        `${normalized}.jsx`,
        `${normalized}.js`,
        `${normalized}.mjs`,
        `${normalized}.css`,
        `${normalized}.json`,
        `${normalized}/index.tsx`,
        `${normalized}/index.ts`,
        `${normalized}/index.jsx`,
        `${normalized}/index.js`,
      ];
  return candidates.find((candidate) => files.has(candidate)) || null;
}

export async function compilePreviewProject(
  files: readonly GeneratedFile[],
  htmlPath: string,
): Promise<{ javascript: string; css: string }> {
  const fileContents = new Map(files.map((file) => [file.path, file.content]));
  const html = fileContents.get(htmlPath);
  if (!html) throw new Error('The preview HTML file was not found in this bundle.');

  const entries = findPreviewBuildEntries(htmlPath, html, files);
  if (!entries.script && !entries.stylesheets.length) return { javascript: '', css: '' };
  const imports = [
    ...entries.stylesheets.map((stylesheet) => `import ${JSON.stringify(`/${stylesheet}`)};`),
    ...(entries.script ? [`import ${JSON.stringify(`/${entries.script}`)};`] : []),
  ].join('\n');

  const result = await build({
    absWorkingDir: process.cwd(),
    entryPoints: [virtualEntry],
    bundle: true,
    write: false,
    outdir: '/relay-preview-output',
    entryNames: 'preview',
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    jsx: 'automatic',
    minify: true,
    logLevel: 'silent',
    legalComments: 'none',
    charset: 'utf8',
    loader: assetLoaders,
    plugins: [
      {
        name: 'isolated-preview-files',
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.kind === 'entry-point')
              return { path: virtualEntry, namespace: 'relay-preview' };
            if (args.namespace !== 'relay-preview') return null;
            if (args.path.startsWith('data:')) return { path: args.path, external: true };
            if (reactImport.test(args.path)) return null;
            if (/^[a-z][a-z\d+.-]*:/i.test(args.path) || args.path.startsWith('//'))
              return {
                errors: [{ text: 'External network imports are not available in previews.' }],
              };
            if (
              !args.path.startsWith('.') &&
              !args.path.startsWith('/') &&
              !args.path.startsWith('@/')
            )
              return {
                errors: [{ text: 'Only local files and React imports are supported in previews.' }],
              };

            const resolved = resolveProjectFile(args.path, args.importer || '', fileContents);
            if (!resolved) return { errors: [{ text: `Preview import not found: ${args.path}` }] };
            return { path: resolved, namespace: 'relay-preview' };
          });
          build.onLoad({ filter: /.*/, namespace: 'relay-preview' }, (args) => {
            if (args.path === virtualEntry)
              return { contents: imports, loader: 'tsx', resolveDir: process.cwd() };
            const contents = fileContents.get(args.path);
            if (contents === undefined)
              return { errors: [{ text: `Preview file not found: ${args.path}` }] };
            const extension = path.posix.extname(args.path).toLowerCase();
            const loader =
              assetLoaders[extension] ||
              (extension === '.tsx'
                ? 'tsx'
                : extension === '.ts'
                  ? 'ts'
                  : extension === '.jsx'
                    ? 'jsx'
                    : extension === '.json'
                      ? 'json'
                      : extension === '.css'
                        ? 'css'
                        : 'js');
            return { contents, loader, resolveDir: process.cwd() };
          });
        },
      },
    ],
  });

  const javascript = result.outputFiles
    .filter((file) => file.path.endsWith('.js'))
    .map((file) => file.text)
    .join('\n');
  const css = result.outputFiles
    .filter((file) => file.path.endsWith('.css'))
    .map((file) => file.text)
    .join('\n');
  if (javascript.length + css.length > 1_500_000)
    throw new Error('The compiled preview is too large to display safely.');
  return { javascript, css };
}
