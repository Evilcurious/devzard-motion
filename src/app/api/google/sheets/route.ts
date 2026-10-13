import { NextResponse } from "next/server";
import { guard, readJson, isCronAuthorized } from "@/lib/api";
import { syncSheet } from "@/lib/sync/sheets";
import { getGoogleConfig, setJson } from "@/lib/settings";
import { createSpreadsheet, ensureTabs, formatHeader } from "@/lib/google/sheets";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { mode: "push" | "pull" | "both" } */
export async function POST(request: Request) {
  if (!(await guard()) && !isCronAuthorized(request)) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const body = await readJson<{ mode?: "push" | "pull" | "both" }>(request);
  return NextResponse.json(await syncSheet(body.mode ?? "both"));
}

/** Create (or re-create) the tracking spreadsheet and write headers. */
export async function PUT(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const created = await createSpreadsheet();
    await ensureTabs(created.id);
    await formatHeader(created.id);
    const cfg = await getGoogleConfig();
    await setJson("google_config", { ...cfg, sheetId: created.id, sheetUrl: created.url });
    await logActivity("success", "Google Sheet created", { sheetUrl: created.url });
    return NextResponse.json({ ok: true, sheetId: created.id, sheetUrl: created.url });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  if (!(await guard()) && !isCronAuthorized(request)) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const cfg = await getGoogleConfig();
  if (!cfg.sheetId) return NextResponse.json({ ok: true, simulated: true, error: "No spreadsheet yet — click Create sheet." });
  return NextResponse.json(await syncSheet("both"));
}
