import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { guard } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel") ?? "";
  const status = searchParams.get("status") ?? "";

  const db = await getDb();
  const rows = await db.all(
    `SELECT v.*,
            (SELECT body FROM messages m WHERE m.conversation_id = v.id ORDER BY m.created_at DESC LIMIT 1) AS last_body,
            (SELECT role FROM messages m WHERE m.conversation_id = v.id ORDER BY m.created_at DESC LIMIT 1) AS last_role,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = v.id) AS message_count,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = v.id AND m.role = 'ai' AND m.status = 'draft') AS drafts
       FROM conversations v
      WHERE (? = '' OR v.channel = ?) AND (? = '' OR v.status = ?)
      ORDER BY v.last_message_at DESC LIMIT 100`,
    [channel, channel, status, status],
  );
  return NextResponse.json({ conversations: rows });
}
