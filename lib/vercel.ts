import { readConnection, removeConnection, saveConnection } from './connection-store';

export type VercelConnection = {
  token: string;
  teamId: string;
  username: string;
  name: string;
};
export type VercelProject = {
  id: string;
  name: string;
  framework: string | null;
};
export type VercelProjectSelection = VercelProject;
export type VercelDeployment = {
  id: string;
  name: string;
  url: string;
  state: string;
  target: string | null;
  createdAt: number;
};

async function vercelApi(path: string, token: string) {
  const response = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
    redirect: 'error',
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401)
      throw new Error('Vercel rejected this access token. Check it and connect again.');
    if (response.status === 403)
      throw new Error('Vercel denied access. Check the token permissions and selected team.');
    throw new Error(`Vercel returned HTTP ${response.status}. Please try again.`);
  }
  return body;
}

function teamQuery(teamId: string) {
  return teamId ? `&teamId=${encodeURIComponent(teamId)}` : '';
}

export async function getVercelConnection() {
  return readConnection<VercelConnection>('vercel');
}

export async function listVercelProjects(connection: VercelConnection): Promise<VercelProject[]> {
  const body = await vercelApi(
    `/v9/projects?limit=100${teamQuery(connection.teamId)}`,
    connection.token,
  );
  return (Array.isArray(body?.projects) ? body.projects : [])
    .filter((project: any) => typeof project?.id === 'string' && typeof project?.name === 'string')
    .map((project: any) => ({
      id: project.id as string,
      name: project.name as string,
      framework: typeof project.framework === 'string' ? (project.framework as string) : null,
    })) as VercelProject[];
}

export async function connectVercel(token: string, teamId = '') {
  const normalizedToken = token.trim();
  const normalizedTeam = teamId.trim();
  const user = await vercelApi('/v2/user', normalizedToken);
  const username = typeof user?.user?.username === 'string' ? user.user.username : '';
  if (!username) throw new Error('Vercel authenticated, but did not return an account name.');
  const connection: VercelConnection = {
    token: normalizedToken,
    teamId: normalizedTeam,
    username,
    name: typeof user?.user?.name === 'string' ? user.user.name : username,
  };
  const projects = await listVercelProjects(connection);
  const previous = await getVercelConnection();
  if (previous && (previous.username !== username || previous.teamId !== normalizedTeam))
    await removeConnection('vercel_project');
  await saveConnection('vercel', connection);
  return { connection, projects };
}

export async function selectVercelProject(projectId: string) {
  const connection = await getVercelConnection();
  if (!connection) throw new Error('Connect Vercel first.');
  const project = (await listVercelProjects(connection)).find((item) => item.id === projectId);
  if (!project) throw new Error('Choose a Vercel project available to this account and team.');
  await saveConnection('vercel_project', project);
  return project;
}

export async function listVercelDeployments(
  connection: VercelConnection,
  project: VercelProjectSelection,
) {
  const query = `/v6/deployments?projectId=${encodeURIComponent(project.id)}&limit=8${teamQuery(connection.teamId)}`;
  const body = await vercelApi(query, connection.token);
  return (Array.isArray(body?.deployments) ? body.deployments : [])
    .filter((deployment: any) => typeof deployment?.uid === 'string')
    .map((deployment: any) => ({
      id: deployment.uid as string,
      name: typeof deployment.name === 'string' ? (deployment.name as string) : project.name,
      url: typeof deployment.url === 'string' ? (deployment.url as string) : '',
      state:
        typeof deployment.readyState === 'string'
          ? (deployment.readyState as string)
          : typeof deployment.state === 'string'
            ? (deployment.state as string)
            : 'UNKNOWN',
      target: typeof deployment.target === 'string' ? (deployment.target as string) : null,
      createdAt: typeof deployment.createdAt === 'number' ? (deployment.createdAt as number) : 0,
    })) satisfies VercelDeployment[];
}

export async function disconnectVercel() {
  await removeConnection('vercel_project');
  await removeConnection('vercel');
}

export async function getVercelProjectSelection() {
  return readConnection<VercelProjectSelection>('vercel_project');
}
