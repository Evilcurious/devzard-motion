import { z } from 'zod';
import { guard, errorResponse, readJson } from '@/lib/security';
import { generatedArtifactSchema } from '@/lib/generated-files';
import { compilePreviewProject } from '@/lib/preview-compiler';

export const runtime = 'nodejs';
export const maxDuration = 15;

const previewRequestSchema = z
  .object({
    htmlPath: z.string().min(1).max(240),
    artifact: generatedArtifactSchema,
  })
  .strict();

export async function POST(request: Request) {
  try {
    await guard(request);
    const { artifact, htmlPath } = previewRequestSchema.parse(await readJson(request, 3_500_000));
    const preview = await compilePreviewProject(artifact.files, htmlPath);
    return Response.json(preview, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && 'errors' in error)
      return Response.json(
        {
          error:
            'Could not compile this preview. Check its local imports and supported React packages.',
        },
        { status: 422 },
      );
    return errorResponse(error);
  }
}
