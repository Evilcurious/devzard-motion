import { NextResponse } from "next/server";
import { guard, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { listCustomers, upsertCustomerRecord } from "@/lib/finance";
import { remove } from "@/lib/db/helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ customers: await listCustomers() });
}

export async function POST(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await readJson<{ id?: string; name?: string; email?: string; phone?: string; company?: string; notes?: string; tags?: string; channel?: string }>(request);
  if (!body.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const id = await upsertCustomerRecord({
    id: body.id,
    name: body.name.trim(),
    email: body.email,
    phone: body.phone,
    company: body.company,
    notes: body.notes,
    tags: body.tags,
    channel: body.channel,
  });
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const db = await getDb();
  await db.run("UPDATE transactions SET customer_id = '' WHERE customer_id = ?", [id]);
  await remove("customers", id);
  return NextResponse.json({ ok: true });
}
