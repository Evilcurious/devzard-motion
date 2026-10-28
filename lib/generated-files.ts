import { z } from 'zod';
import {
  isSafeGeneratedPath,
  MAX_GENERATED_FILE_BYTES,
  MAX_GENERATED_FILE_CHARACTERS,
  MAX_GENERATED_FILES,
} from './generated-file-policy';
export {
  isSafeGeneratedPath,
  MAX_GENERATED_FILE_BYTES,
  MAX_GENERATED_FILE_CHARACTERS,
  MAX_GENERATED_FILES,
} from './generated-file-policy';

const generatedFileSchema = z
  .object({
    path: z.string().min(1).max(240).refine(isSafeGeneratedPath, 'File path is not safe.'),
    content: z.string().max(MAX_GENERATED_FILE_CHARACTERS),
  })
  .strict();

export const generatedFilesSchema = z
  .array(generatedFileSchema)
  .min(1)
  .max(MAX_GENERATED_FILES)
  .superRefine((files, context) => {
    let totalBytes = 0;
    const paths = new Set<string>();
    for (const [index, file] of files.entries()) {
      const key = file.path.toLowerCase();
      if (paths.has(key))
        context.addIssue({
          code: 'custom',
          path: [index, 'path'],
          message: 'File paths must be unique (case-insensitive).',
        });
      paths.add(key);
      totalBytes += new TextEncoder().encode(file.content).byteLength;
    }
    if (totalBytes > MAX_GENERATED_FILE_BYTES)
      context.addIssue({
        code: 'custom',
        message: `Generated bundle exceeds the ${MAX_GENERATED_FILE_BYTES.toLocaleString()} byte limit.`,
      });
  });

const bundleName = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u, 'Use a simple project name without path characters.');

export const generatedFileBundleSchema = z
  .object({ name: bundleName, files: generatedFilesSchema })
  .strict();

export const generatedArtifactSchema = z
  .object({ id: z.string().min(1).max(200), name: bundleName, files: generatedFilesSchema })
  .strict();

export const generatedArtifactReferenceSchema = z
  .object({
    id: z.string().min(1).max(200),
    name: bundleName,
    fileCount: z.number().int().min(1).max(MAX_GENERATED_FILES),
    totalBytes: z.number().int().min(0).max(MAX_GENERATED_FILE_BYTES),
    hasPreview: z.boolean(),
    paths: z
      .array(z.string().min(1).max(240).refine(isSafeGeneratedPath, 'File path is not safe.'))
      .max(MAX_GENERATED_FILES),
  })
  .strict();

export type GeneratedFile = z.infer<typeof generatedFileSchema>;
export type GeneratedArtifact = z.infer<typeof generatedArtifactSchema>;
export type GeneratedArtifactReference = z.infer<typeof generatedArtifactReferenceSchema>;

export function generatedArtifactReference(
  artifact: GeneratedArtifact,
): GeneratedArtifactReference {
  return {
    id: artifact.id,
    name: artifact.name,
    fileCount: artifact.files.length,
    totalBytes: artifact.files.reduce(
      (sum, file) => sum + new TextEncoder().encode(file.content).byteLength,
      0,
    ),
    hasPreview: artifact.files.some((file) => /\.html?$/i.test(file.path)),
    paths: artifact.files.map((file) => file.path),
  };
}

export function findHtmlPreviewFile(files: GeneratedFile[]) {
  const htmlFiles = files.filter((file) => /\.html?$/i.test(file.path));
  return (
    htmlFiles.find((file) => file.path.toLowerCase() === 'index.html') ||
    htmlFiles.find((file) => /(?:^|\/)index\.html$/i.test(file.path)) ||
    htmlFiles[0]
  );
}
