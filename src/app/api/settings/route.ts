import { NextResponse } from "next/server";
import { guard, readJson } from "@/lib/api";
import {
  getAiConfig,
  getChatbotConfig,
  getFinanceConfig,
  getGoogleConfig,
  getMetaConfig,
  googleClientSecret,
  googleTokens,
  setAiConfig,
  setJson,
  CHATBOT_DEFAULTS,
  FINANCE_DEFAULTS,
  META_DEFAULTS,
  type AiConfig,
  type ChatbotConfig,
  type FinanceConfig,
  type MetaConfig,
} from "@/lib/settings";
import { encrypt } from "@/lib/crypto";
import type { ProviderId } from "@/lib/ai/types";

const MASK = "••••••••";
const mask = (v: string) => (v ? MASK : "");

export async function GET() {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const ai = await getAiConfig();
  const google = await getGoogleConfig();
  const meta = await getMetaConfig();
  const tokens = googleTokens(google);

  const keys: Record<string, string> = {};
  for (const [p, k] of Object.entries(ai.keys ?? {})) keys[p] = mask(k as string);

  return NextResponse.json({
    ai: {
      provider: ai.provider,
      model: ai.model,
      temperature: ai.temperature,
      maxTokens: ai.maxTokens,
      fallbackProvider: ai.fallbackProvider,
      fallbackModel: ai.fallbackModel,
      keys,
      bases: ai.bases ?? {},
    },
    chatbot: await getChatbotConfig(),
    finance: await getFinanceConfig(),
    google: {
      clientId: google.clientId,
      hasClientSecret: !!googleClientSecret(google),
      connected: !!tokens,
      email: google.email,
      sheetId: google.sheetId,
      sheetUrl: google.sheetUrl,
      lastHistoryId: google.lastHistoryId,
      connectedAt: google.connectedAt,
      scopes: tokens?.scope ?? "",
    },
    meta: {
      verifyToken: meta.verifyToken,
      apiVersion: meta.apiVersion,
      waPhoneId: meta.waPhoneId,
      igAccountId: meta.igAccountId,
      hasWaToken: !!meta.waTokenEnc,
      hasIgToken: !!meta.igTokenEnc,
      hasAppSecret: !!meta.appSecretEnc,
      autoReplyWhatsapp: meta.autoReplyWhatsapp,
      autoReplyInstagram: meta.autoReplyInstagram,
    },
  });
}

export async function POST(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await readJson<{
    ai?: Partial<AiConfig> & { keys?: Record<string, string>; bases?: Record<string, string> };
    chatbot?: Partial<ChatbotConfig>;
    finance?: Partial<FinanceConfig>;
    google?: { clientId?: string; clientSecret?: string; sheetId?: string };
    meta?: Partial<MetaConfig> & {
      waToken?: string;
      igToken?: string;
      appSecret?: string;
    };
  }>(request);

  if (body.ai) {
    const current = await getAiConfig();
    const keys: Record<string, string> = { ...(current.keys as Record<string, string>) };
    const incomingKeys = (body.ai.keys ?? {}) as Record<string, string>;
    for (const [p, v] of Object.entries(incomingKeys)) {
      if (v && v !== MASK) keys[p] = v;
    }
    if (body.ai.provider && !keys[body.ai.provider] && current.keys?.[body.ai.provider]) {
      keys[body.ai.provider] = current.keys[body.ai.provider] as string;
    }
    await setAiConfig({
      provider: (body.ai.provider ?? current.provider) as ProviderId,
      model: body.ai.model ?? current.model,
      temperature: Number(body.ai.temperature ?? current.temperature),
      maxTokens: Number(body.ai.maxTokens ?? current.maxTokens),
      fallbackProvider: (body.ai.fallbackProvider ?? current.fallbackProvider) as ProviderId | "",
      fallbackModel: body.ai.fallbackModel ?? current.fallbackModel,
      bases: { ...(current.bases ?? {}), ...(body.ai.bases ?? {}) },
      keys: keys as AiConfig["keys"],
    });
  }

  if (body.chatbot) {
    const current = await getChatbotConfig();
    await setJson("chatbot_config", {
      ...CHATBOT_DEFAULTS,
      ...current,
      ...body.chatbot,
      channels: { ...current.channels, ...(body.chatbot.channels ?? {}) },
    });
  }

  if (body.finance) {
    const current = await getFinanceConfig();
    await setJson("finance_config", {
      ...FINANCE_DEFAULTS,
      ...current,
      ...body.finance,
      monthlyBudget: Number(body.finance.monthlyBudget ?? current.monthlyBudget),
      aiBudget: Number(body.finance.aiBudget ?? current.aiBudget),
    });
  }

  if (body.google) {
    const current = await getGoogleConfig();
    await setJson("google_config", {
      ...current,
      clientId: body.google.clientId ?? current.clientId,
      clientSecretEnc:
        body.google.clientSecret && body.google.clientSecret !== MASK
          ? encrypt(body.google.clientSecret)
          : current.clientSecretEnc,
      sheetId: body.google.sheetId ?? current.sheetId,
    });
  }

  if (body.meta) {
    const current = await getMetaConfig();
    await setJson("meta_config", {
      ...META_DEFAULTS,
      ...current,
      verifyToken: body.meta.verifyToken ?? current.verifyToken,
      apiVersion: body.meta.apiVersion ?? current.apiVersion,
      waPhoneId: body.meta.waPhoneId ?? current.waPhoneId,
      igAccountId: body.meta.igAccountId ?? current.igAccountId,
      autoReplyWhatsapp: body.meta.autoReplyWhatsapp ?? current.autoReplyWhatsapp,
      autoReplyInstagram: body.meta.autoReplyInstagram ?? current.autoReplyInstagram,
      waTokenEnc: body.meta.waToken && body.meta.waToken !== MASK ? encrypt(body.meta.waToken) : current.waTokenEnc,
      igTokenEnc: body.meta.igToken && body.meta.igToken !== MASK ? encrypt(body.meta.igToken) : current.igTokenEnc,
      appSecretEnc: body.meta.appSecret && body.meta.appSecret !== MASK ? encrypt(body.meta.appSecret) : current.appSecretEnc,
    });
  }

  return NextResponse.json({ ok: true });
}
