import { NextResponse } from "next/server";
import { checkPassword, sessionCookieOptions, sessionValue, SESSION_COOKIE } from "@/lib/auth";
import { readJson } from "@/lib/api";

export async function POST(request: Request) {
  const { user, password } = await readJson<{ user?: string; password?: string }>(request);
  if (!checkPassword(user ?? "", password ?? "")) {
    return NextResponse.json({ error: "Wrong username or password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionValue(user ?? "admin"), sessionCookieOptions);
  return res;
}
