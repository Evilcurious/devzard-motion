import { z } from 'zod';
import { errorResponse, readJson, requireAdmin, guard } from '@/lib/security';
import { getWorkspaceBranding, normalizeBranding, saveWorkspaceBranding } from '@/lib/branding';
import { isAccentColor } from '@/lib/appearance';
import { isTheme } from '@/lib/themes';

export const dynamic = 'force-dynamic';
const schema = z.object({
  theme: z.string().refine(isTheme, 'Choose a supported workspace theme.'),
  appearance: z.object({
    accentColor: z
      .string()
      .nullable()
      .refine((value) => value === null || isAccentColor(value)),
    fontId: z.string().max(40),
    customFont: z
      .object({
        name: z.string().max(100),
        format: z.enum(['woff2', 'woff', 'ttf', 'otf']),
        data: z
          .string()
          .max(1_400_000)
          .regex(/^[A-Za-z0-9+/]*={0,2}$/),
      })
      .nullable(),
  }),
  logoDataUrl: z.string().max(350_000).nullable(),
});

export async function GET() {
  try {
    await guard();
    return Response.json(await getWorkspaceBranding());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const input = schema.parse(await readJson(request, 1_850_000));
    const branding = normalizeBranding(input);
    if (input.logoDataUrl && !branding.logoDataUrl)
      throw new Error('Use a PNG, JPG, or WebP logo no larger than 256 KB.');
    await saveWorkspaceBranding(branding);
    return Response.json({ ok: true, branding });
  } catch (error) {
    return errorResponse(error);
  }
}
