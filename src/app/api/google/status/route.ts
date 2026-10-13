import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { getGoogleConfig, googleTokens } from "@/lib/settings";
import { redirectUri } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const cfg = await getGoogleConfig();
  const tokens = googleTokens(cfg);
  return NextResponse.json({
    clientConfigured: !!cfg.clientId && !!(process.env.GOOGLE_CLIENT_SECRET || cfg.clientSecretEnc),
    connected: !!tokens,
    email: cfg.email,
    sheetId: cfg.sheetId,
    sheetUrl: cfg.sheetUrl,
    scopes: tokens?.scope ?? "",
    redirectUri: redirectUri(),
  });
}

export async function DELETE() {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const cfg = await getGoogleConfig();
  await (await import("@/lib/settings")).setJson("google_config", {
    ...cfg,
    tokensEnc: "",
    email: "",
    lastHistoryId: "",
    connectedAt: "",
    sheetId: "",
    sheetUrl: "",
  });
  return NextResponse.json({ ok: true });
}
