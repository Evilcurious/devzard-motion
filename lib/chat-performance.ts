type ChatRoutePreference = {
  strategy?: string;
  autoPick?: boolean;
};

export function needsDynamicModelRouting(config: ChatRoutePreference) {
  return (
    config.strategy === 'fallback' ||
    config.strategy === 'fusion' ||
    config.strategy === 'auto-fusion' ||
    config.autoPick !== false
  );
}

export function isFileBundleRequest(
  messages: ReadonlyArray<{ role: string; content?: string | null }>,
) {
  const latestUserText = [...messages]
    .reverse()
    .find((message) => message.role === 'user')
    ?.content?.trim();
  if (!latestUserText) return false;
  if (
    /\b(?:not|don't|doesn't|isn't|can't|cannot)\b.{0,50}\b(?:make|create|build|generate|package|zip)\b/i.test(
      latestUserText,
    )
  )
    return false;

  const creation =
    /\b(?:make|create|build|generate|package|export|write|design|develop|give|provide|want|need)\b/i;
  const artifact =
    /\b(?:zip(?:\s+(?:file|archive|bundle))?|downloadable\s+(?:project|files?|bundle)|file\s+bundle|code\s+project|website|web\s*app|web\s*page|html\s+(?:site|page|file|viewer)|landing\s+page|portfolio\s+(?:site|page|website)|dashboard\s+app|app|site|page)\b/i;
  return creation.test(latestUserText) && artifact.test(latestUserText);
}

export function shouldLoadRepositoryContext(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
) {
  const recentUserText = messages
    .filter((message) => message.role === 'user')
    .slice(-4)
    .map((message) => message.content)
    .join('\n');

  return /\b(?:git(?:hub)?|repo(?:sitory)?|playground|codebase|source\s+code|readme|pull\s+request|commit|branch|debug(?:ging)?|bug|fix|refactor|implement|tests?|components?|functions?|api\s+routes?)\b/i.test(
    recentUserText,
  );
}
