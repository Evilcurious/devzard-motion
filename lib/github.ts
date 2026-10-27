import { createSign } from 'node:crypto';
import { readConnection } from './connection-store';

export type GitHubInstallation = { installationId: number; account: string };
export type GitHubRepository = {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
};
export type GitHubSelection = GitHubRepository;
export type GitHubFile = { path: string; content: string };
export type GitHubPushAction = {
  name: 'github_push_files';
  args: { commitMessage: string; files: GitHubFile[] };
};

export type GitHubAppSettings = {
  appId: string;
  slug: string;
  privateKey: string;
  appURL?: string;
};

export async function githubAppConfig() {
  const saved = await readConnection<GitHubAppSettings>('github_app', 'owner');
  return {
    appId: saved?.appId || process.env.GITHUB_APP_ID || '',
    slug: saved?.slug || process.env.GITHUB_APP_SLUG || '',
    privateKey: (saved?.privateKey || process.env.GITHUB_APP_PRIVATE_KEY || '').replace(
      /\\n/g,
      '\n',
    ),
    appURL: (saved?.appURL || process.env.APP_URL || '').replace(/\/$/, ''),
  };
}

export function validateGitHubFiles(files: unknown): GitHubFile[] {
  if (!Array.isArray(files) || files.length < 1 || files.length > 30)
    throw new Error('A repository update must contain between 1 and 30 files.');
  let totalBytes = 0;
  const paths = new Set<string>();
  return files.map((file) => {
    if (!file || typeof file !== 'object') throw new Error('Invalid repository file.');
    const { path, content } = file as Record<string, unknown>;
    if (
      typeof path !== 'string' ||
      !path.trim() ||
      path.length > 240 ||
      path.startsWith('/') ||
      path.includes('\\') ||
      /[\x00-\x1f\x7f]/.test(path)
    )
      throw new Error('A repository file has an invalid path.');
    const segments = path.split('/');
    if (
      segments.some((part) => !part || part === '.' || part === '..') ||
      segments.some((part) => part.toLowerCase() === '.git') ||
      /^\.github\/workflows\//i.test(path) ||
      segments.some((part) => /^\.env(?:$|\.(?!example$))/i.test(part)) ||
      /\.(?:pem|key|p12|pfx)$/i.test(path)
    )
      throw new Error(`The path “${path}” is not allowed in a generated commit.`);
    if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > 100_000)
      throw new Error(`File “${path}” is too large or is not text.`);
    const normalized = path.normalize('NFC');
    if (paths.has(normalized)) throw new Error(`Duplicate repository path: ${path}`);
    paths.add(normalized);
    totalBytes += Buffer.byteLength(content, 'utf8');
    if (totalBytes > 500_000) throw new Error('The repository update is larger than 500 KB.');
    return { path: normalized, content };
  });
}

export function validateGitHubCommitMessage(value: unknown) {
  if (typeof value !== 'string') throw new Error('A commit message is required.');
  const message = value.trim();
  if (!message || message.length > 120 || /[\x00-\x1f\x7f]/.test(message))
    throw new Error('The commit message must be 1–120 characters on one line.');
  return message;
}

async function appJwt() {
  const { appId, privateKey } = await githubAppConfig();
  if (!appId || !privateKey || !privateKey.includes('PRIVATE KEY'))
    throw new Error('GitHub App credentials are not configured on this Relay server.');
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const signingInput = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: now - 60, exp: now + 8 * 60, iss: appId })}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${signer.sign(privateKey).toString('base64url')}`;
}

async function githubApi(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(20000),
    redirect: 'error',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      response.status === 401 || response.status === 404
        ? 'GitHub access has expired or the repository is no longer available. Reconnect GitHub and choose a repository again.'
        : response.status === 403
          ? 'GitHub denied this operation. Check the GitHub App installation and repository permissions.'
          : `GitHub returned HTTP ${response.status}. Check the repository before retrying.`;
    throw new Error(error);
  }
  return data;
}

export async function getGitHubInstallation() {
  return readConnection<GitHubInstallation>('github');
}

export async function getGitHubInstallationDetails(id: number) {
  const data = await githubApi(`/app/installations/${id}`, await appJwt());
  const account = data?.account?.login;
  if (typeof account !== 'string' || !account)
    throw new Error('The GitHub App installation could not be verified.');
  return { installationId: id, account } satisfies GitHubInstallation;
}

export async function getGitHubInstallationToken(installation?: GitHubInstallation) {
  const activeInstallation = installation || (await getGitHubInstallation());
  if (!activeInstallation) throw new Error('Connect a GitHub repository in Connections first.');
  const jwt = await appJwt();
  const response = await fetch(
    `https://api.github.com/app/installations/${activeInstallation.installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${jwt}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ permissions: { contents: 'write', metadata: 'read' } }),
      signal: AbortSignal.timeout(20000),
      redirect: 'error',
    },
  );
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.token !== 'string')
    throw new Error('Could not obtain a GitHub installation token. Reconnect the GitHub App.');
  return data.token as string;
}

export async function listGitHubRepositories() {
  const installation = await getGitHubInstallation();
  if (!installation) return [];
  const token = await getGitHubInstallationToken(installation);
  const repositories: GitHubRepository[] = [];
  for (let page = 1; page <= 3; page++) {
    const data = await githubApi(`/installation/repositories?per_page=100&page=${page}`, token);
    const items = Array.isArray(data?.repositories) ? data.repositories : [];
    for (const repo of items) {
      if (
        repo.permissions?.push === false ||
        !Number.isSafeInteger(repo.id) ||
        typeof repo.full_name !== 'string'
      )
        continue;
      repositories.push({
        id: repo.id,
        fullName: repo.full_name,
        name: repo.name,
        owner: repo.owner?.login || repo.full_name.split('/')[0],
        private: !!repo.private,
        defaultBranch: repo.default_branch || 'main',
        htmlUrl: repo.html_url,
      });
    }
    if (items.length < 100) break;
  }
  return repositories;
}

export async function getSelectedGitHubRepository() {
  return readConnection<GitHubSelection>('github_repository');
}

export async function selectGitHubRepository(id: number) {
  const repo = (await listGitHubRepositories()).find((item) => item.id === id);
  if (!repo) throw new Error('Choose a repository granted to the GitHub App with write access.');
  return repo;
}

export async function pushGitHubFiles(
  selection: GitHubSelection,
  action: GitHubPushAction['args'],
  branchSuffix: string,
) {
  const files = validateGitHubFiles(action.files);
  const message = validateGitHubCommitMessage(action.commitMessage);
  const token = await getGitHubInstallationToken();
  const owner = encodeURIComponent(selection.owner);
  const repo = encodeURIComponent(selection.name);
  const base = `/repos/${owner}/${repo}`;
  const branchSegments = selection.defaultBranch.split('/').map(encodeURIComponent).join('/');
  const ref = await githubApi(`${base}/git/ref/heads/${branchSegments}`, token);
  const parent = await githubApi(
    `${base}/git/commits/${encodeURIComponent(ref.object.sha)}`,
    token,
  );
  const tree = await githubApi(`${base}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: parent.tree.sha,
      tree: files.map(({ path, content }) => ({ path, mode: '100644', type: 'blob', content })),
    }),
  });
  const commit = await githubApi(`${base}/git/commits`, token, {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] }),
  });
  const branch = `relay/${branchSuffix}`;
  const created = await githubApi(`${base}/git/refs`, token, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
  });
  return {
    message: `Pushed ${files.length} file${files.length === 1 ? '' : 's'} to ${selection.fullName} on branch ${branch}.`,
    branch,
    commitUrl: `https://github.com/${selection.fullName}/commit/${commit.sha}`,
    branchUrl: created.url ? `https://github.com/${selection.fullName}/tree/${branch}` : '',
  };
}

export async function uninstallGitHubApp() {
  const installation = await getGitHubInstallation();
  if (!installation) return;
  const jwt = await appJwt();
  const response = await fetch(
    `https://api.github.com/app/installations/${installation.installationId}`,
    {
      method: 'DELETE',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${jwt}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(20000),
      redirect: 'error',
    },
  );
  if (!response.ok && response.status !== 404)
    throw new Error(
      'GitHub could not revoke the app installation. Try again or remove Relay in GitHub Settings → Applications.',
    );
}
