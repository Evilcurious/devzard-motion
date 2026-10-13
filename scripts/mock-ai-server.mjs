#!/usr/bin/env node
/**
 * Tiny OpenAI-compatible server for local testing.
 *
 * Lets you exercise the whole pipeline (chatbot → email draft → WhatsApp reply)
 * with zero API keys and zero models downloaded:
 *
 *   node scripts/mock-ai-server.mjs
 *   AI_PROVIDER=custom CUSTOM_BASE_URL=http://localhost:4000/v1 CUSTOM_MODEL=devzard-mock npm run dev
 *
 * It "reads" the knowledge base the app sends in the system prompt and quotes
 * from it, so grounded replies look real.
 */
import http from "node:http";

const PORT = Number(process.env.MOCK_AI_PORT || 4000);

const server = http.createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify(body));
  };

  if (req.method === "OPTIONS") return send(204, {});

  if (req.url === "/v1/models" || req.url === "/models") {
    return send(200, {
      object: "list",
      data: [
        { id: "devzard-mock", object: "model" },
        { id: "devzard-mock-verbose", object: "model" },
      ],
    });
  }

  if (req.url === "/api/tags") {
    return send(200, { models: [{ name: "devzard-mock" }] });
  }

  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let body = {};
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      /* ignore */
    }

    const messages = body.messages ?? [];
    const system = messages
      .filter((m) => m && m.role === "system")
      .map((m) => m.content)
      .join("\n");
    const question = [...messages].reverse().find((m) => m && m.role === "user")?.content ?? "";

    // Pull the knowledge block back out so the reply looks grounded.
    const knowledge = (system.match(/--- KNOWLEDGE BASE \(authoritative\) ---([\s\S]*?)--- END KNOWLEDGE BASE ---/)?.[1] ?? "").trim();
    const snippets = knowledge
      .split(/\n\n\[\d+\]/)
      .map((s) => s.replace(/^\[\d+\]/, "").trim())
      .filter(Boolean);

    let answer;
    if (/reply with exactly: ok/i.test(question)) {
      answer = "OK";
    } else if (!snippets.length || /no knowledge base entries matched/i.test(knowledge)) {
      answer = (system.match(/fallback and nothing else: "([^"]+)"/)?.[1] ??
        "Thanks for reaching out — I don't have that detail to hand, a teammate will follow up shortly.");
    } else {
      const first = snippets[0].replace(/\s+/g, " ").slice(0, 320);
      answer = `${first}`;
    }

    const tokensIn = Math.ceil(JSON.stringify(messages).length / 4);
    const tokensOut = Math.ceil(answer.length / 4);

    if (req.url.includes("/api/chat")) {
      return send(200, {
        model: body.model ?? "devzard-mock",
        message: { role: "assistant", content: answer },
        prompt_eval_count: tokensIn,
        eval_count: tokensOut,
        done: true,
      });
    }

    send(200, {
      id: "chatcmpl-mock",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: body.model ?? "devzard-mock",
      choices: [
        { index: 0, message: { role: "assistant", content: answer }, finish_reason: "stop" },
      ],
      usage: { prompt_tokens: tokensIn, completion_tokens: tokensOut, total_tokens: tokensIn + tokensOut },
    });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[mock-ai] OpenAI-compatible stub on http://localhost:${PORT}/v1`);
});
