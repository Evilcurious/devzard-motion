import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { syncGmail } from "@/lib/sync/gmail";
import { isCronAuthorized } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await guard()) && !isCronAuthorized(request)) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const report = await syncGmail();
  return NextResponse.json(report);
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await syncGmail());
}
