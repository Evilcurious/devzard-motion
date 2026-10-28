export type OpenAIStreamMessage = {
  role: 'assistant';
  content: string | null;
  tool_calls?: {
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }[];
};

export async function readOpenAIChatStream(
  body: ReadableStream<Uint8Array> | null,
  onText: (text: string) => void = () => undefined,
): Promise<{ message: OpenAIStreamMessage; usage: unknown }> {
  if (!body) throw new Error('The provider returned an empty streaming response.');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();
  let content = '';
  let usage: unknown;
  let buffer = '';
  let dataLines: string[] = [];
  let finished = false;

  const processEvent = (data: string) => {
    if (!data || data === '[DONE]') return;
    let chunk: any;
    try {
      chunk = JSON.parse(data);
    } catch {
      throw new Error('The provider returned an invalid streaming response.');
    }
    if (chunk.usage) usage = chunk.usage;
    const delta = chunk.choices?.[0]?.delta;
    if (typeof delta?.content === 'string' && delta.content) {
      content += delta.content;
      onText(delta.content);
    }
    if (Array.isArray(delta?.tool_calls)) {
      for (const partial of delta.tool_calls) {
        const index = Number.isInteger(partial.index) ? partial.index : 0;
        const current = toolCalls.get(index) || { id: '', name: '', arguments: '' };
        if (typeof partial.id === 'string') current.id += partial.id;
        if (typeof partial.function?.name === 'string') current.name += partial.function.name;
        if (typeof partial.function?.arguments === 'string')
          current.arguments += partial.function.arguments;
        toolCalls.set(index, current);
      }
    }
  };

  const processLine = (line: string) => {
    if (line === '') {
      processEvent(dataLines.join('\n'));
      dataLines = [];
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);
        processLine(line);
        newline = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    if (buffer) processLine(buffer.replace(/\r$/, ''));
    if (dataLines.length) processEvent(dataLines.join('\n'));
    finished = true;
  } finally {
    if (!finished) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }

  const calls = [...toolCalls.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, call], index) => ({
      id: call.id || `streamed-tool-${index}`,
      type: 'function',
      function: { name: call.name, arguments: call.arguments },
    }));
  if (!content && !calls.length)
    throw new Error('The model returned an empty response. Try another model.');
  return {
    message: {
      role: 'assistant',
      content: content || null,
      ...(calls.length ? { tool_calls: calls } : {}),
    },
    usage,
  };
}
