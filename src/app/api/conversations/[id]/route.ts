import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { guard, readJson } from "@/lib/api";
import { regenerate, sendAgentReply } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const db = await getDb();
  const conversation = await db.get("SELECT * FROM conversations WHERE id = ?", [id]);
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const messages = await db.all("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC", [id]);
  await db.run("UPDATE conversations SET unread = 0 WHERE id = ?", [id]);
  return NextResponse.json({ conversation, messages });
}

/** { body } → send a human reply. { regenerate: true } → ask the model again. */
export async function POST(request: Request, { params }: Ctx) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const body = await readJson<{ body?: string; regenerate?: boolean }>(request);

  if (body.regenerate) {
    try {
      return NextResponse.json({ ok: true, ...(await regenerate(id)) });
    } catch (err) {
      return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
    }
  }

  if (!body.body?.trim()) return NextResponse.json({ error: "Empty reply" }, { status: 400 });
  const result = await sendAgentReply(id, body.body.trim());
  return NextResponse.json(result);
}

export async function PATCH(request: Request, { params }: Ctx) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const body = await readJson<{ status?: string; unread?: number }>(request);
  const db = await getDb();
  if (body.status) await db.run("UPDATE conversations SET status = ? WHERE id = ?", [body.status, id]);
  if (typeof body.unread === "number") await db.run("UPDATE conversations SET unread = ? WHERE id = ?", [body.unread, id]);
  return NextResponse.json({ ok: true });
}
