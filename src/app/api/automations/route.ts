import { NextResponse } from "next/server";
import { guard, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { insert, remove, update } from "@/lib/db/helpers";
import { emptyRule, getRule, listRules } from "@/lib/automations";
import type { AutomationRule } from "@/lib/automations";

export const dynamic = "force-dynamic";

export async function GET() {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ rules: await listRules() });
}

export async function POST(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await readJson<Partial<AutomationRule>>(request);
  const base = emptyRule();
  const id = newId("rule");
  await insert("automations", {
    id,
    name: body.name?.trim() || base.name,
    enabled: body.enabled ?? 1,
    channel: body.channel ?? "any",
    trigger: body.trigger ?? "new_message",
    conditions: JSON.stringify({ ...base.conditions, ...(body.conditions ?? {}) }),
    actions: JSON.stringify({ ...base.actions, ...(body.actions ?? {}) }),
    run_count: 0,
  });
  return NextResponse.json({ ok: true, id });
}

export async function PUT(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await readJson<Partial<AutomationRule> & { id?: string }>(request);
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const current = await getRule(body.id);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.enabled !== undefined) patch.enabled = body.enabled ? 1 : 0;
  if (body.channel !== undefined) patch.channel = body.channel;
  if (body.trigger !== undefined) patch.trigger = body.trigger;
  if (body.conditions !== undefined) patch.conditions = JSON.stringify({ ...current.conditions, ...body.conditions });
  if (body.actions !== undefined) patch.actions = JSON.stringify({ ...current.actions, ...body.actions });

  await update("automations", body.id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await remove("automations", id);
  return NextResponse.json({ ok: true });
}

export async function PATCH() {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = await getDb();
  await db.run("UPDATE automations SET run_count = 0");
  return NextResponse.json({ ok: true });
}
