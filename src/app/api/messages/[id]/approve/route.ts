import { NextResponse } from "next/server";
import { guard, readJson } from "@/lib/api";
import { approveDraft } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const body = await readJson<{ body?: string }>(request);
  const result = await approveDraft(id, body.body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
