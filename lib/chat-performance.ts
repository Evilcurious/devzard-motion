type ChatRoutePreference = {
  strategy?: string;
  autoPick?: boolean;
};

export async function attemptTargetsSequentially<TTarget, TResult>(
  targets: readonly TTarget[],
  attempt: (target: TTarget, index: number) => Promise<TResult>,
  shouldContinue: () => boolean = () => true,
  onError?: (error: unknown, target: TTarget, index: number) => void | Promise<void>,
): Promise<
  | { ok: true; target: TTarget; value: TResult; index: number; attemptsMade: number }
  | { ok: false; error: unknown; attemptsMade: number }
> {
  let lastError: unknown = new Error('All fallback models failed.');
  let attemptsMade = 0;
  for (const [index, target] of targets.entries()) {
    if (!shouldContinue()) break;
    attemptsMade++;
    try {
      return { ok: true, target, value: await attempt(target, index), index, attemptsMade };
    } catch (error) {
      lastError = error;
      await onError?.(error, target, index);
    }
  }
  return { ok: false, error: lastError, attemptsMade };
}

export function shouldRouteTurnThroughCandidates(
  turn: number,
  strategy: string | undefined,
  fileBundleRequest: boolean,
) {
  return (
    strategy === 'fallback' ||
    (turn === 0 && (fileBundleRequest || (strategy !== 'fusion' && strategy !== 'auto-fusion')))
  );
}

export function shouldPersistAutoSelectedTarget(
  strategy: string | undefined,
  autoPick: boolean,
  index: number,
  selected: boolean,
) {
  return strategy !== 'fallback' && autoPick && (index > 0 || !selected);
}

export function fallbackAttemptTimeout(
  remainingMs: number,
  attemptsRemaining: number,
  maximumAttemptMs: number,
) {
  if (remainingMs <= 0 || attemptsRemaining <= 0) return 0;
  const fairShare = Math.floor(remainingMs / attemptsRemaining);
  return Math.min(remainingMs, maximumAttemptMs, Math.max(2000, fairShare));
}

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
