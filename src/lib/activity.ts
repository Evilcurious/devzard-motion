import { getDb, nowIso } from "./db";
import { newId } from "./db/ids";

export async function logActivity(level: "info" | "warn" | "error" | "success", message: string, meta: unknown = {}): Promise<void> {
  try {
    const db = await getDb();
    await db.run("INSERT INTO activity (id, level, message, meta, created_at) VALUES (?, ?, ?, ?, ?)", [
      newId("act"),
      level,
      message,
      JSON.stringify(meta ?? {}),
      nowIso(),
    ]);
  } catch {
    /* the feed is non-critical */
  }
}

export async function recentActivity(limit = 30) {
  const db = await getDb();
  return db.all<{ id: string; level: string; message: string; meta: string; created_at: string }>(
    "SELECT * FROM activity ORDER BY created_at DESC LIMIT ?",
    [limit],
  );
}
