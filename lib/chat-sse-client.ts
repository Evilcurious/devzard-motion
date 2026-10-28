type ChatSseEvent =
  | { type: 'delta'; text: string }
  | { type: 'reset' }
  | { type: 'final'; status: number; result: unknown }
  | { type: 'error'; message: string };

export async function readChatEventStream<T>(
  response: Response,
  onText: (text: string) => void,
  onReset: () => void,
): Promise<T> {
  if (!response.body) throw new Error('The chat stream ended before a response was received.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: T | undefined;
  let receivedFinal = false;
  const processLine = (line: string) => {
    if (!line.startsWith('data:')) return;
    let event: ChatSseEvent;
    try {
      event = JSON.parse(line.slice(5).trimStart()) as ChatSseEvent;
    } catch {
      throw new Error('The chat stream contained an invalid event.');
    }
    if (event.type === 'delta') onText(event.text);
    else if (event.type === 'reset') onReset();
    else if (event.type === 'error') throw new Error(event.message);
    else if (event.type === 'final') {
      const payload = event.result as { error?: unknown } | null;
      if (event.status < 200 || event.status >= 300 || payload?.error)
        throw new Error(
          typeof payload?.error === 'string' ? payload.error : 'Could not complete this request.',
        );
      result = event.result as T;
      receivedFinal = true;
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        processLine(buffer.slice(0, newline).replace(/\r$/, ''));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    if (buffer) processLine(buffer.replace(/\r$/, ''));
  } finally {
    reader.releaseLock();
  }
  if (!receivedFinal) throw new Error('The chat stream ended without a final response.');
  return result as T;
}
