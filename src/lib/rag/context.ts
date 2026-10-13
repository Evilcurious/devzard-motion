import type { ChatMessage } from "../ai/types";
import type { ChatbotConfig } from "../settings";
import { retrieve, type Retrieved } from "./retrieve";

export interface ReplyContext {
  channel: "web" | "email" | "whatsapp" | "instagram";
  customerName?: string;
  customerNote?: string;
  /** previous turns of this conversation, oldest first */
  history?: { role: "customer" | "agent" | "ai"; body: string }[];
  threadSubject?: string;
  extraInstructions?: string;
}

const CHANNEL_RULES: Record<ReplyContext["channel"], string> = {
  web: "This is a live website chat widget. Keep replies under 60 words. Plain text, no markdown.",
  email:
    "This is an email reply. Start with a short greeting, keep it under 150 words, and end with the signature provided. No subject line.",
  whatsapp: "This is WhatsApp. Very short (max 40 words), no markdown, no links unless they were provided to you.",
  instagram: "This is an Instagram DM. Short and friendly (max 40 words), no markdown.",
};

export async function buildMessages(
  question: string,
  cfg: ChatbotConfig,
  ctx: ReplyContext,
): Promise<{ messages: ChatMessage[]; sources: Retrieved[] }> {
  const sources = await retrieve(question, 5);

  const knowledge = sources.length
    ? sources.map((s, i) => `[${i + 1}] (${s.title})\n${s.text}`).join("\n\n")
    : "No knowledge base entries matched this question.";

  const system = [
    `You are "${cfg.name}", an AI assistant for this business.`,
    cfg.systemPrompt,
    `Tone: ${cfg.tone}.`,
    `Channel rules: ${CHANNEL_RULES[ctx.channel]}`,
    `Hard rules: ${cfg.guardrails}`,
    `If the knowledge base does not contain the answer, reply with exactly this fallback and nothing else: "${cfg.fallbackReply}"`,
    `Never mention "the knowledge base", "context", "sources" or numbered references in your reply.`,
    ctx.customerName ? `The customer's name is ${ctx.customerName}.` : "",
    ctx.customerNote ? `Known about this customer: ${ctx.customerNote}` : "",
    ctx.threadSubject ? `Email subject: ${ctx.threadSubject}` : "",
    ctx.extraInstructions ?? "",
    ``,
    `--- KNOWLEDGE BASE (authoritative) ---`,
    knowledge,
    `--- END KNOWLEDGE BASE ---`,
  ]
    .filter(Boolean)
    .join("\n");

  const messages: ChatMessage[] = [{ role: "system", content: system }];

  for (const turn of (ctx.history ?? []).slice(-8)) {
    messages.push({ role: turn.role === "customer" ? "user" : "assistant", content: turn.body });
  }
  messages.push({ role: "user", content: question });

  return { messages, sources };
}

/** Rough self-reported confidence: does the answer lean on what we fed it? */
export function scoreConfidence(sources: Retrieved[], answer: string): number {
  if (!answer.trim()) return 0;
  if (!sources.length) return 0.15;
  const top = sources[0].score;
  const base = Math.min(0.95, 0.35 + Math.log1p(Math.max(top, 0)) * 0.22);
  const words = answer.trim().split(/\s+/).length;
  const lengthPenalty = words > 220 ? 0.9 : words < 3 ? 0.85 : 1;
  return Math.round(Math.max(0, Math.min(0.99, base * lengthPenalty)) * 100) / 100;
}

/**
 * Escalate when the model admits it doesn't know, or when the *customer*
 * asked about something sensitive (refunds, complaints, legal…).
 */
export function needsHuman(opts: { answer: string; question: string; cfg: ChatbotConfig }): boolean {
  const { answer, question, cfg } = opts;
  const fallback = cfg.fallbackReply.slice(0, 25).toLowerCase();
  if (fallback && answer.toLowerCase().includes(fallback)) return true;

  const keywords = cfg.handoffKeywords
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (!keywords.length) return false;

  const asked = question.toLowerCase();
  return keywords.some((k) => asked.includes(k));
}
