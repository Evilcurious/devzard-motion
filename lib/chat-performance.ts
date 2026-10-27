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
