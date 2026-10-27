import { createPrivateKey } from 'node:crypto';
import { z } from 'zod';
import { removeConnection, saveConnection } from '@/lib/connection-store';
import { githubAppConfig, type GitHubAppSettings } from '@/lib/github';
import { databaseConfigured, dbQuery } from '@/lib/db';
import { errorResponse, requireAdmin, readJson } from '@/lib/security';

async function clearGitHubUserConnections() {
  if (databaseConfigured())
    await dbQuery("DELETE FROM relay_settings WHERE key LIKE 'account:%:github' OR key LIKE 'account:%:github_repository'");
}

const siteURL = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine(
    (value) =>
      (new URL(value).protocol === 'https:' || new URL(value).hostname === 'localhost') &&
      new URL(value).pathname === '/' &&
      !new URL(value).search &&
      !new URL(value).hash,
    'Enter the site origin only, such as https://relay.example.com.',
  );
const schema = z.object({
  appId: z
    .string()
    .trim()
    .regex(/^\d{1,40}$/, 'Enter the numeric GitHub App ID.'),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9-]+$/, 'Use the GitHub App URL slug (letters, numbers and hyphens).'),
  privateKey: z.string().trim().max(7000).optional(),
  appURL: siteURL,
});

export async function GET() {
  try {
    await requireAdmin();
    const config = await githubAppConfig();
    const secureSettings = (process.env.SESSION_SECRET?.length || 0) >= 32;
    return Response.json({
      appId: config.appId,
      slug: config.slug,
      appURL: config.appURL,
      keySaved: !!config.privateKey,
      configured: !!(
        config.appId &&
        config.slug &&
        config.privateKey &&
        config.appURL &&
        secureSettings
      ),
      setupURL: config.appURL ? `${config.appURL}/api/github/callback` : '',
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const input = schema.parse(await readJson(request, 9000));
    const current = await githubAppConfig();
    const privateKey = (
      input.privateKey || (input.appId === current.appId ? current.privateKey : '')
    ).replace(/\\n/g, '\n');
    if (!privateKey) throw new Error('Enter the GitHub App private key PEM.');
    try {
      createPrivateKey(privateKey);
    } catch {
      throw new Error('That private key could not be read. Paste the complete GitHub App PEM key.');
    }
    await saveConnection('github_app', {
      appId: input.appId,
      slug: input.slug,
      privateKey,
      appURL: input.appURL.replace(/\/$/, ''),
    } satisfies GitHubAppSettings, 'owner');
    if (input.appId !== current.appId || input.slug !== current.slug) {
      await clearGitHubUserConnections();
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
    await removeConnection('github_app', 'owner');
    await clearGitHubUserConnections();
    await removeConnection('github', 'owner');
    await removeConnection('github_repository', 'owner');
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
