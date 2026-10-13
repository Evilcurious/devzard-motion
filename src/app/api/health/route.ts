import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAiConfig } from "@/lib/settings";
import { getGoogleConfig, googleTokens, googleClientSecret } from "@/lib/settings";
import { metaSecrets } from "@/lib/settings";
import { providerMeta } from "@/lib/ai/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = true;
  let dbKind = "unknown";
  try {
    const db = await getDb();
    dbKind = db.kind;
    await db.get("SELECT 1 AS ok");
  } catch {
    dbOk = false;
  }

  const ai = await getAiConfig();
  const google = await getGoogleConfig();
  const meta = await metaSecrets();
  const pm = providerMeta(ai.provider);

  return NextResponse.json({
    ok: dbOk,
    db: { kind: dbKind, ok: dbOk },
    ai: {
      provider: ai.provider,
      model: ai.model,
      local: pm.local,
      keyPresent: !!(ai.keys?.[ai.provider] ?? ""),
      fallback: ai.fallbackProvider || null,
    },
    google: {
      clientConfigured: !!google.clientId && !!googleClientSecret(google),
      connected: !!googleTokens(google),
      sheetId: google.sheetId,
    },
    whatsapp: { configured: !!(meta.waPhoneId && meta.waToken) },
    instagram: { configured: !!(meta.igAccountId && meta.igToken) },
  });
}
