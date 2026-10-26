import { z } from 'zod';
import { errorResponse, guard, readJson } from '@/lib/security';
import {
  connectVercel,
  disconnectVercel,
  getVercelConnection,
  getVercelProjectSelection,
  listVercelDeployments,
  listVercelProjects,
  selectVercelProject,
} from '@/lib/vercel';

const connectSchema = z.object({
  action: z.literal('connect'),
  token: z.string().trim().min(10).max(3000),
  teamId: z.string().trim().max(200).optional(),
});
const selectSchema = z.object({
  action: z.literal('select-project'),
  projectId: z.string().trim().min(1).max(200),
});
const disconnectSchema = z.object({ action: z.literal('disconnect') });

export async function GET() {
  try {
    await guard();
    const connection = await getVercelConnection();
    if (!connection)
      return Response.json({ connected: false, projects: [], selection: null, deployments: [] });
    const [projects, selection] = await Promise.all([
      listVercelProjects(connection),
      getVercelProjectSelection(),
    ]);
    const selected =
      selection && projects.some((project) => project.id === selection.id) ? selection : null;
    const deployments = selected ? await listVercelDeployments(connection, selected) : [];
    return Response.json({
      connected: true,
      account: { username: connection.username, name: connection.name },
      projects,
      selection: selected,
      deployments,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await guard(request);
    const payload = await readJson(request, 5000);
    if (payload?.action === 'connect') {
      const input = connectSchema.parse(payload);
      const { connection, projects } = await connectVercel(input.token, input.teamId);
      return Response.json({
        connected: true,
        account: { username: connection.username, name: connection.name },
        projects,
        selection: null,
        deployments: [],
      });
    }
    if (payload?.action === 'select-project') {
      const input = selectSchema.parse(payload);
      const selection = await selectVercelProject(input.projectId);
      const connection = await getVercelConnection();
      const deployments = connection ? await listVercelDeployments(connection, selection) : [];
      return Response.json({ selection, deployments });
    }
    disconnectSchema.parse(payload);
    await disconnectVercel();
    return Response.json({ connected: false });
  } catch (error) {
    return errorResponse(error);
  }
}
