import { emailSchema, sheetSchema } from './tools';
import { generatedArtifactSchema } from './generated-files';
import { fontOptions } from './appearance';
import { z } from 'zod';
const short = z.string().max(200);
const review = {
  id: short,
  token: z
    .string()
    .optional()
    .transform(() => ''),
  state: z.enum(['done', 'cancelled', 'failed']).optional(),
  result: z.string().max(20000).optional(),
  resultUrl: z
    .string()
    .url()
    .max(2000)
    .refine((value) => new URL(value).hostname === 'github.com')
    .optional(),
};
const githubProposal = z
  .object({
    ...review,
    name: z.literal('github_push_files'),
    repository: z
      .object({
        id: z.number().int().positive(),
        fullName: z.string().min(3).max(200),
        defaultBranch: z.string().min(1).max(200),
        htmlUrl: z
          .string()
          .url()
          .max(2000)
          .refine((value) => new URL(value).hostname === 'github.com'),
      })
      .optional(),
    args: z
      .object({
        commitMessage: z.string().min(1).max(120),
        files: z
          .array(z.object({ path: z.string().min(1).max(240), content: z.string().max(100_000) }))
          .min(1)
          .max(30),
      })
      .superRefine((args, context) => {
        if (
          args.files.reduce((sum, file) => sum + Buffer.byteLength(file.content, 'utf8'), 0) >
          500_000
        )
          context.addIssue({
            code: 'custom',
            message: 'GitHub proposal exceeds the file-size limit.',
          });
      }),
  })
  .strict();
const proposal = z.discriminatedUnion('name', [
  z.object({ ...review, name: z.literal('send_email'), args: emailSchema }),
  z.object({ ...review, name: z.literal('append_to_sheet'), args: sheetSchema }),
  githubProposal,
]);
export const workspaceSchema = z.object({
  conversations: z
    .array(
      z.object({
        id: short,
        title: short,
        updated: z.string().max(50),
        messages: z
          .array(
            z.object({
              id: short,
              role: z.enum(['user', 'assistant']),
              content: z.string().max(50000),
              error: z.boolean().optional(),
              steps: z.array(short).max(50).optional(),
              modelUsed: z
                .object({ modelId: short, providerId: short, providerName: short })
                .optional(),
              media: z
                .object({
                  type: z.enum(['image', 'video']),
                  urls: z.array(z.string().url().max(2000)).max(8),
                  providerName: short.optional(),
                  modelId: short.optional(),
                })
                .optional(),
              sources: z
                .array(
                  z.object({
                    title: short,
                    url: z.string().url().max(2000),
                    snippet: z.string().max(2000),
                  }),
                )
                .max(10)
                .optional(),
              attachment: z
                .object({
                  name: short,
                  text: z.string().max(40000),
                  pages: z.number().optional(),
                  truncated: z.boolean().optional(),
                })
                .optional(),
              artifacts: z.array(generatedArtifactSchema).max(2).optional(),
              proposals: z.array(proposal).max(10).optional(),
            }),
          )
          .max(500),
      }),
    )
    .max(300),
  activities: z
    .array(
      z.object({
        id: short,
        title: short,
        description: z.string().max(30000),
        type: z.enum(['email', 'sheet', 'file', 'error']),
        at: z.string().max(50),
      }),
    )
    .max(200),
  workflows: z
    .array(
      z.object({
        id: short,
        title: short,
        description: z.string().max(1000),
        prompt: z.string().max(6000),
        icon: z.enum(['email', 'sheet', 'sparkles']),
        custom: z.boolean().optional(),
      }),
    )
    .max(200),
  theme: z
    .enum(['light', 'dark', 'green', 'black', 'red', 'blue', 'yellow', 'gold'])
    .default('light'),
  appearance: z
    .object({
      accentColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .nullable()
        .default(null),
      fontId: z.enum(fontOptions.map((font) => font.id) as [string, ...string[]]).default('arial'),
      customFont: z
        .object({
          name: z.string().max(100),
          format: z.enum(['woff2', 'woff', 'ttf', 'otf']),
          data: z
            .string()
            .max(1_400_000)
            .regex(/^[A-Za-z0-9+/]*={0,2}$/),
        })
        .nullable()
        .default(null),
    })
    .default({ accentColor: null, fontId: 'arial', customFont: null }),
});
export const workspaceWriteSchema = z.object({
  revision: z.number().int().min(0),
  data: workspaceSchema,
});
