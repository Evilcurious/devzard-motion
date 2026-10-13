import { getDb } from "../db";

export interface Retrieved {
  chunkId: string;
  sourceId: string;
  title: string;
  url: string;
  text: string;
  score: number;
}

const STOP = new Set(
  ("a an and are as at be by can do does for from has have how i if in is it its me my of on or our so than that the their them then there these they this to us was we were what when where which who why will with you your please thanks thank hi hello" as string).split(
    " ",
  ),
);

function stem(word: string): string {
  return word.length > 4 ? word.replace(/(ing|ed|es|s|ly)$/, "") : word;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

interface Doc {
  chunkId: string;
  sourceId: string;
  title: string;
  url: string;
  text: string;
  terms: string[];
}

/**
 * Small, dependency-free BM25.
 * Chosen on purpose: it needs no embedding API, so it works identically with
 * a paid cloud key, a laptop-running Ollama model, or a box in your LAN.
 */
export async function retrieve(query: string, topK = 5, maxDocs = 4000): Promise<Retrieved[]> {
  const db = await getDb();
  const rows = await db.all<{
    chunk_id: string;
    source_id: string;
    title: string;
    url: string;
    text: string;
  }>(
    `SELECT c.id AS chunk_id, c.source_id, s.title, s.url, c.text
       FROM kb_chunks c
       JOIN kb_sources s ON s.id = c.source_id
      WHERE s.enabled = 1
      LIMIT ?`,
    [maxDocs],
  );

  if (!rows.length) return [];

  const docs: Doc[] = rows.map((r) => ({
    chunkId: r.chunk_id,
    sourceId: r.source_id,
    title: r.title,
    url: r.url,
    text: r.text,
    terms: tokenize(`${r.title} ${r.title} ${r.text}`),
  }));

  const qTerms = tokenize(query);
  if (!qTerms.length) return [];

  const N = docs.length;
  const avgLen = docs.reduce((a, d) => a + d.terms.length, 0) / N || 1;
  const df = new Map<string, number>();
  for (const t of new Set(qTerms)) {
    let n = 0;
    for (const d of docs) if (d.terms.includes(t)) n++;
    df.set(t, n);
  }

  const k1 = 1.4;
  const b = 0.75;
  const scored: Retrieved[] = [];

  for (const d of docs) {
    let score = 0;
    for (const t of qTerms) {
      const tf = d.terms.reduce((a, x) => a + (x === t ? 1 : 0), 0);
      if (!tf) continue;
      const n = df.get(t) ?? 1;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * d.terms.length) / avgLen)));
    }
    // exact-phrase bonus: the whole question appearing verbatim in the chunk
    const needle = query.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
    if (needle.length > 12 && d.text.toLowerCase().includes(needle)) score += 3;
    // title match bonus
    if (qTerms.some((t) => tokenize(d.title).includes(t))) score += 1.5;

    if (score > 0) {
      scored.push({ chunkId: d.chunkId, sourceId: d.sourceId, title: d.title, url: d.url, text: d.text, score });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}
