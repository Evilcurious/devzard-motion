import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/api";
import { syncSheet } from "@/lib/sync/sheets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await syncSheet("both"));
}
