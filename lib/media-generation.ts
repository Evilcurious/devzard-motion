export const XKIRO_IMAGE_MODEL_ID = 'sensenova/sensenova-u1.5-lite';

export function xkiroImageGenerationRequest(prompt: string) {
  return {
    model: XKIRO_IMAGE_MODEL_ID,
    prompt,
    n: 1,
    size: '1024x1024',
  };
}

const RETRYABLE_IMAGE_PROVIDER_ERROR =
  /(400|401|402|403|404|408|422|429|500|502|503|504|quota|credit|rate.?limit|timed? ?out|network|fetch failed|failed|failure|invalid|insecure|did not return|did not include|model.{0,30}(?:not found|unknown|unsupported|unavailable|not available)|(?:not found|unsupported).{0,30}model|image.{0,30}(?:unsupported|unavailable|not enabled))/i;

export function canTryAnotherImageProvider(error: unknown) {
  if (!(error instanceof Error)) return false;
  if (
    /\b(blocked|safety|moderation|policy|disallowed|prohibited|content filter)\b/i.test(
      error.message,
    )
  )
    return false;
  return RETRYABLE_IMAGE_PROVIDER_ERROR.test(error.message);
}
