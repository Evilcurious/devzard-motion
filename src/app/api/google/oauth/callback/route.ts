import { NextResponse } from "next/server";
import { appUrl, exchangeCode, googleProfile } from "@/lib/google/oauth";
import { getGoogleConfig, setGoogleTokens, setJson } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { nowIso } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${appUrl()}/dashboard/settings?google=${encodeURIComponent(error ?? "no_code")}`);
  }

  try {
    const tokens = await exchangeCode(code);
    await setGoogleTokens(tokens);
    const profile = await googleProfile();
    const cfg = await getGoogleConfig();
    await setJson("google_config", {
      ...(await getGoogleConfig()),
      email: profile?.email ?? cfg.email,
      connectedAt: nowIso(),
      lastHistoryId: "",
    });
    await logActivity("success", `Google account connected${profile?.email ? ` (${profile.email})` : ""}`);
    return NextResponse.redirect(`${appUrl()}/dashboard/settings?google=connected`);
  } catch (err) {
    return NextResponse.redirect(
      `${appUrl()}/dashboard/settings?google=${encodeURIComponent((err as Error).message.slice(0, 120))}`,
    );
  }
}
