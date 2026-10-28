export type ContextChatMessage = { role: string; content: string | null };

function estimateTokens(messages: readonly ContextChatMessage[]) {
  return messages.reduce(
    (sum, message) => sum + Math.ceil((message.content?.length || 0) / 4) + 4,
    0,
  );
}

function trimText(text: string, maxCharacters: number) {
  if (text.length <= maxCharacters) return text;
  const marker = '\n[…older context shortened to fit the selected model…]\n';
  const available = Math.max(0, maxCharacters - marker.length);
  const head = Math.ceil(available * 0.72);
  const tail = available - head;
  return `${text.slice(0, head)}${marker}${tail ? text.slice(-tail) : ''}`;
}

/** Keep the system prompt and newest complete turns, dropping/trimming older chat for a small model window. */
export function fitChatMessagesToContext<T extends ContextChatMessage>(
  messages: readonly T[],
  contextTokens: number | null | undefined,
  maxOutputTokens: number,
) {
  const originalTokens = estimateTokens(messages);
  if (!contextTokens || contextTokens < 512) {
    return {
      messages: [...messages],
      originalTokens,
      sentTokens: originalTokens,
      omittedMessages: 0,
    };
  }

  const outputReserve = Math.min(maxOutputTokens, Math.max(256, Math.floor(contextTokens * 0.2)));
  const promptBudget = Math.max(256, contextTokens - outputReserve - 256);
  if (originalTokens <= promptBudget) {
    return {
      messages: [...messages],
      originalTokens,
      sentTokens: originalTokens,
      omittedMessages: 0,
    };
  }

  const systemMessages = messages.filter((message) => message.role === 'system');
  const conversation = messages.filter((message) => message.role !== 'system');
  let fittedSystem = [...systemMessages];
  let systemTokens = estimateTokens(fittedSystem);
  const maxSystemTokens = Math.max(128, Math.floor(promptBudget * 0.55));
  if (systemTokens > maxSystemTokens && fittedSystem.length) {
    const first = fittedSystem[0];
    fittedSystem[0] = {
      ...first,
      content: trimText(first.content || '', maxSystemTokens * 4),
    } as T;
    fittedSystem = fittedSystem.slice(0, 1);
    systemTokens = estimateTokens(fittedSystem);
  }

  const turns: T[][] = [];
  for (const message of conversation) {
    if (message.role === 'user' || !turns.length) turns.push([message]);
    else turns[turns.length - 1].push(message);
  }

  let remaining = Math.max(0, promptBudget - systemTokens);
  const keptTurns: T[][] = [];
  let omittedMessages = 0;
  for (let index = turns.length - 1; index >= 0; index--) {
    const turn = turns[index];
    const cost = estimateTokens(turn);
    if (cost <= remaining) {
      keptTurns.unshift(turn);
      remaining -= cost;
      continue;
    }
    omittedMessages += turns
      .slice(0, index + 1)
      .reduce((count, omitted) => count + omitted.length, 0);
    if (
      index === turns.length - 1 &&
      turn.length === 1 &&
      turn[0].role === 'user' &&
      remaining >= 96
    ) {
      const latest = turn[0];
      keptTurns.unshift([
        {
          ...latest,
          content: trimText(latest.content || '', Math.max(128, remaining * 4)),
        } as T,
      ]);
    }
    break;
  }

  const fitted = [...fittedSystem, ...keptTurns.flat()];
  const sentTokens = estimateTokens(fitted);
  return {
    messages: fitted,
    originalTokens,
    sentTokens,
    omittedMessages,
  };
}
