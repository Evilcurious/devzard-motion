const generationAction = /\b(?:create|generate|make|draw|paint|illustrate|render)\b/i;
const imageOutput = /\b(?:image|picture|illustration|photo|artwork|wallpaper)\b/i;

export function isImageGenerationPrompt(input: string) {
  const text = input.trim();
  if (
    !text ||
    text.length > 12_000 ||
    /^\s*(?:how|what|why|when|where)\b/i.test(text) ||
    !generationAction.test(text) ||
    !imageOutput.test(text)
  )
    return false;
  if (
    /\b(?:website|web\s*app|application|repository|repo|github|code|source\s+code|programming)\b/i.test(
      text,
    )
  )
    return false;
  if (/\b(?:prompt|instructions?)\b.{0,30}\b(?:image|picture|artwork|photo)\b/i.test(text))
    return false;
  return true;
}
