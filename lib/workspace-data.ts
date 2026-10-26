import { emailSchema, sheetSchema } from './tools';
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
};
const proposal = z.discriminatedUnion('name', [
  z.object({ ...review, name: z.literal('send_email'), args: emailSchema }),
  z.object({ ...review, name: z.literal('append_to_sheet'), args: sheetSchema }),
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
              attachment: z
                .object({
                  name: short,
                  text: z.string().max(40000),
                  pages: z.number().optional(),
                  truncated: z.boolean().optional(),
                })
                .optional(),
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
  theme: z.enum(['green', 'black', 'red', 'blue', 'yellow', 'gold']).default('green'),
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
