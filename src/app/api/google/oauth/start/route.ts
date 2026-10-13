import { NextResponse } from "next/server";
import { authUrl, redirectUri } from "@/lib/google/oauth";
import { getGoogleConfig, googleClientSecret } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = await getGoogleConfig();
  if (!cfg.clientId || !googleClientSecret(cfg)) {
    return NextResponse.json(
      { error: "Add your Google OAuth Client ID + Secret in Settings → Integrations first.", redirectUri: redirectUri() },
      { status: 400 },
    );
  }
  return NextResponse.redirect(authUrl("dashboard"));
}
