import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listVercelDeployments, listVercelProjects, type VercelConnection } from '../lib/vercel';

const connection: VercelConnection = {
  token: 'private-vercel-token-value',
  teamId: 'team_123',
  username: 'relay-owner',
  name: 'Relay Owner',
};

test('Vercel project listing uses the fixed API host, hides credentials and returns bounded fields', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  let requestedURL = '';
  let authorization = '';
  globalThis.fetch = async (input, init) => {
    requestedURL = String(input);
    authorization = new Headers(init?.headers).get('Authorization') || '';
    return Response.json({
      projects: [
        { id: 'prj_1', name: 'relay', framework: 'nextjs', secret: 'never return' },
        { id: null, name: 'invalid project' },
      ],
    });
  };

  const projects = await listVercelProjects(connection);
  assert.equal(requestedURL, 'https://api.vercel.com/v9/projects?limit=100&teamId=team_123');
  assert.equal(authorization, `Bearer ${connection.token}`);
  assert.deepEqual(projects, [{ id: 'prj_1', name: 'relay', framework: 'nextjs' }]);
  assert.equal(JSON.stringify(projects).includes(connection.token), false);
});

test('Vercel deployment listing reports only the selected project and safe deployment fields', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  let requestedURL = '';
  globalThis.fetch = async (input) => {
    requestedURL = String(input);
    return Response.json({
      deployments: [
        {
          uid: 'dpl_1',
          name: 'relay',
          url: 'relay-preview.vercel.app',
          readyState: 'READY',
          target: 'production',
          createdAt: 1000,
          secret: 'never return',
        },
      ],
    });
  };

  const deployments = await listVercelDeployments(connection, {
    id: 'prj_1',
    name: 'relay',
    framework: 'nextjs',
  });
  assert.match(requestedURL, /^https:\/\/api\.vercel\.com\/v6\/deployments\?/);
  assert.match(requestedURL, /projectId=prj_1/);
  assert.deepEqual(deployments, [
    {
      id: 'dpl_1',
      name: 'relay',
      url: 'relay-preview.vercel.app',
      state: 'READY',
      target: 'production',
      createdAt: 1000,
    },
  ]);
  assert.equal(JSON.stringify(deployments).includes(connection.token), false);
});

test('Vercel token rejection returns actionable text without exposing provider response bodies', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: connection.token } }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });

  await assert.rejects(listVercelProjects(connection), (error: Error) => {
    assert.match(error.message, /rejected this access token/);
    assert.equal(error.message.includes(connection.token), false);
    return true;
  });
});
