import { NextResponse } from "next/server";
import { guard, readJson } from "@/lib/api";
import { addSource, deleteSource, htmlToText, kbStats, listSources, updateSource } from "@/lib/kb";

export const dynamic = "force-dynamic";

export async function GET() {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ sources: await listSources(), stats: await kbStats() });
}

export async function POST(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await readJson<{ id?: string; title?: string; content?: string; kind?: string; url?: string; tags?: string; enabled?: number }>(request);

  if (body.id) {
    await updateSource(body.id, {
      title: body.title,
      content: body.content,
      tags: body.tags,
      enabled: body.enabled,
      url: body.url,
    });
    return NextResponse.json({ ok: true, id: body.id });
  }

  if (!body.content?.trim()) return NextResponse.json({ error: "Content is required" }, { status: 400 });
  const result = await addSource({
    title: body.title?.trim() || "Untitled",
    content: body.content,
    kind: (body.kind as "text" | "qa" | "url") ?? "text",
    url: body.url,
    tags: body.tags,
  });
  return NextResponse.json({ ok: true, ...result });
}

export async function DELETE(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await deleteSource(id);
  return NextResponse.json({ ok: true });
}

/** Import a public page into the knowledge base. */
export async function PUT(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await readJson<{ url?: string }>(request);
  if (!body.url?.startsWith("http")) return NextResponse.json({ error: "A valid http(s) URL is required" }, { status: 400 });
  try {
    const res = await fetch(body.url, { headers: { "user-agent": "DevzardMotion/1.0" }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: 400 });
    const text = htmlToText(await res.text());
    const result = await addSource({
      title: body.url.replace(/^https?:\/\//, "").slice(0, 80),
      content: text.slice(0, 40_000),
      kind: "url",
      url: body.url,
    });
    return NextResponse.json({ ok: true, ...result, chars: text.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
