/** Split knowledge into retrieval-friendly chunks. */

export interface Chunk {
  index: number;
  text: string;
}

const TARGET = 900;
const OVERLAP = 140;

export function chunkText(text: string, kind: "qa" | "text" = "text"): Chunk[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];

  // Q&A blocks (Q: ... A: ...) are kept intact — they retrieve far better.
  if (kind === "qa") {
    const blocks = clean
      .split(/\n(?=\s*(?:Q|Question)\s*[:.-])/i)
      .map((b) => b.trim())
      .filter(Boolean);
    if (blocks.length > 1) return blocks.map((b, i) => ({ index: i, text: b.slice(0, 2000) }));
  }

  const paragraphs = clean.split(/\n{2,}/);
  const chunks: Chunk[] = [];
  let buffer = "";

  const flush = () => {
    const t = buffer.trim();
    if (t) chunks.push({ index: chunks.length, text: t });
    buffer = "";
  };

  for (const p of paragraphs) {
    if (buffer.length + p.length + 2 <= TARGET) {
      buffer = buffer ? `${buffer}\n\n${p}` : p;
      continue;
    }
    if (buffer) flush();
    if (p.length <= TARGET) {
      buffer = p;
      continue;
    }
    // Hard-split very long paragraphs on sentence boundaries.
    let start = 0;
    while (start < p.length) {
      const slice = p.slice(start, start + TARGET);
      const cut = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
      const end = start + (cut > 200 ? cut + 1 : TARGET);
      chunks.push({ index: chunks.length, text: p.slice(start, end).trim() });
      start = end - OVERLAP > start ? end - OVERLAP : end;
    }
  }
  flush();

  return chunks.filter((c) => c.text.length > 2);
}

export function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
