import { NextRequest, NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE } from "@/lib/auth/users";

/** POST /api/auth/logout — cierra la sesión y borra la cookie. */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  try {
    await destroySession(token);
  } catch {
    /* sin base de datos accesible: la cookie se borra igualmente */
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
