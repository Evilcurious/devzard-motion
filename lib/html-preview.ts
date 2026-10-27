import type { GeneratedFile } from './generated-files';
import { isSafeGeneratedPath } from './generated-file-policy';

export type PreviewBuildEntries = {
  script: string | null;
  stylesheets: string[];
};

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match?.[2] || '';
}

export function resolvePreviewFilePath(fromPath: string, reference: string) {
  const trimmed = reference.trim();
  if (!trimmed || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(trimmed) || trimmed.startsWith('#'))
    return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed.split(/[?#]/, 1)[0]);
  } catch {
    return null;
  }
  if (decoded.includes('\\') || decoded.includes(':')) return null;

  const segments = decoded.startsWith('/') ? [] : fromPath.split('/').slice(0, -1).filter(Boolean);
  for (const part of decoded.replace(/^\/+/, '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!segments.length) return null;
      segments.pop();
    } else {
      segments.push(part);
    }
  }

  const path = segments.join('/');
  return isSafeGeneratedPath(path) ? path : null;
}

export function findPreviewBuildEntries(
  htmlPath: string,
  html: string,
  files: readonly GeneratedFile[],
): PreviewBuildEntries {
  const scriptTag = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi)].find(
    ([tag, , src]) =>
      !!src &&
      (/(?:\.m?js|\.c?tsx?|\.jsx?)(?:[?#].*)?$/i.test(src) ||
        /\btype\s*=\s*(["'])module\1/i.test(tag)),
  );
  let script = scriptTag?.[2] ? resolvePreviewFilePath(htmlPath, scriptTag[2]) : null;

  if (!script) {
    const filePaths = new Set(files.map((file) => file.path));
    script =
      [
        'src/main.tsx',
        'src/main.ts',
        'src/index.tsx',
        'src/index.ts',
        'main.tsx',
        'main.ts',
        'index.tsx',
        'index.ts',
        'src/main.jsx',
        'src/main.js',
        'main.jsx',
        'main.js',
      ].find((path) => filePaths.has(path)) || null;
  }

  const stylesheets = new Set<string>();
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const href = attribute(tag, 'href');
    const rel = attribute(tag, 'rel');
    if (!href || (!/\bstylesheet\b/i.test(rel) && !/\.css(?:[?#].*)?$/i.test(href))) continue;
    const path = resolvePreviewFilePath(htmlPath, href);
    if (path) stylesheets.add(path);
  }

  return { script, stylesheets: [...stylesheets] };
}

const previewCsp =
  "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; media-src data: blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'\">";

function addPreviewCsp(html: string) {
  const head = html.match(/<head\b[^>]*>/i);
  if (head?.index !== undefined)
    return `${html.slice(0, head.index + head[0].length)}${previewCsp}${html.slice(head.index + head[0].length)}`;
  const root = html.match(/<html\b[^>]*>/i);
  if (root?.index !== undefined)
    return `${html.slice(0, root.index + root[0].length)}<head>${previewCsp}</head>${html.slice(root.index + root[0].length)}`;
  const doctype = html.match(/^\s*<!doctype\s+html[^>]*>/i);
  if (doctype)
    return `${doctype[0]}<html><head>${previewCsp}</head><body>${html.slice(doctype[0].length)}</body></html>`;
  return `<!doctype html><html><head>${previewCsp}</head><body>${html}</body></html>`;
}

export function buildSandboxedPreviewDocument(html: string, css = '', javascript = '') {
  let document = addPreviewCsp(html)
    // Local project files are bundled and inlined below; remote resources remain blocked.
    .replace(/<link\b(?=[^>]*\brel\s*=\s*(["'])[^"']*\bstylesheet\b[^"']*\1)[^>]*>/gi, '')
    .replace(/<script\b(?=[^>]*\bsrc\s*=)[^>]*>\s*<\/script\s*>/gi, '');

  const safeCss = css.replace(/<\/style/gi, '<\\/style');
  const safeJavascript = javascript.replace(/<\/script/gi, '<\\/script');
  const styleTag = safeCss ? `<style>${safeCss}</style>` : '';
  const scriptTag = safeJavascript ? `<script>${safeJavascript}</script>` : '';

  if (styleTag) {
    const closingHead = document.search(/<\/head\s*>/i);
    if (closingHead >= 0)
      document = `${document.slice(0, closingHead)}${styleTag}${document.slice(closingHead)}`;
  }
  if (scriptTag) {
    const closingBody = document.search(/<\/body\s*>/i);
    document =
      closingBody >= 0
        ? `${document.slice(0, closingBody)}${scriptTag}${document.slice(closingBody)}`
        : `${document}${scriptTag}`;
  }
  return document;
}
