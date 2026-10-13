import { getDb, nowIso } from "./db";
import { newId } from "./db/ids";
import { insert, remove, update } from "./db/helpers";
import { chunkText } from "./rag/chunk";

export interface KbSource {
  id: string;
  title: string;
  kind: string;
  content: string;
  url: string;
  tags: string;
  enabled: number;
  created_at: string;
  updated_at: string;
  chunks?: number;
}

export async function addSource(input: {
  title: string;
  content: string;
  kind?: "text" | "qa" | "url" | "file";
  url?: string;
  tags?: string;
}): Promise<{ id: string; chunks: number }> {
  const db = await getDb();
  const id = newId("kb");
  const kind = input.kind ?? "text";

  await insert("kb_sources", {
    id,
    title: input.title || "Untitled",
    kind,
    content: input.content,
    url: input.url ?? "",
    tags: input.tags ?? "",
    enabled: 1,
    updated_at: nowIso(),
  });

  const chunks = chunkText(input.content, kind === "qa" ? "qa" : "text");
  for (const c of chunks) {
    await db.run(
      "INSERT INTO kb_chunks (id, source_id, chunk_index, text, created_at) VALUES (?, ?, ?, ?, ?)",
      [newId("ch"), id, c.index, c.text, nowIso()],
    );
  }
  return { id, chunks: chunks.length };
}

export async function updateSource(id: string, patch: Partial<KbSource>): Promise<void> {
  await update("kb_sources", id, { ...patch, updated_at: nowIso() });
  if (typeof patch.content === "string") {
    const src = await getDb().then((db) => db.get<{ kind: string }>("SELECT kind FROM kb_sources WHERE id = ?", [id]));
    await rechunk(id, patch.content, src?.kind === "qa" ? "qa" : "text");
  }
}

export async function rechunk(sourceId: string, content: string, kind: "qa" | "text"): Promise<number> {
  const db = await getDb();
  await db.run("DELETE FROM kb_chunks WHERE source_id = ?", [sourceId]);
  const chunks = chunkText(content, kind);
  for (const c of chunks) {
    await db.run(
      "INSERT INTO kb_chunks (id, source_id, chunk_index, text, created_at) VALUES (?, ?, ?, ?, ?)",
      [newId("ch"), sourceId, c.index, c.text, nowIso()],
    );
  }
  return chunks.length;
}

export async function deleteSource(id: string): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM kb_chunks WHERE source_id = ?", [id]);
  await remove("kb_sources", id);
}

export async function listSources(): Promise<KbSource[]> {
  const db = await getDb();
  return db.all<KbSource>(
    `SELECT s.*, (SELECT COUNT(*) FROM kb_chunks c WHERE c.source_id = s.id) AS chunks
       FROM kb_sources s ORDER BY s.updated_at DESC`,
  );
}

export async function kbStats(): Promise<{ sources: number; chunks: number; chars: number }> {
  const db = await getDb();
  const row = await db.get<{ sources: number; chunks: number; chars: number }>(
    `SELECT (SELECT COUNT(*) FROM kb_sources) AS sources,
            (SELECT COUNT(*) FROM kb_chunks) AS chunks,
            (SELECT COALESCE(SUM(LENGTH(content)),0) FROM kb_sources) AS chars`,
  );
  return row ?? { sources: 0, chunks: 0, chars: 0 };
}

/** Very small HTML -> text extractor for "import from URL". */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
