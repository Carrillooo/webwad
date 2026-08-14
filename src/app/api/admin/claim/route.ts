import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth";
import { promoteToMaster, normalizeEmail } from "@/lib/auth/users";

export const runtime = "nodejs";

/**
 * POST /api/admin/claim — TEMPORAL: promociona a máster SIN clave, pero SOLO
 * a la cuenta del fundador (email fijado abajo) y SOLO si la petición llega
 * con su sesión iniciada. Nadie más puede usarlo aunque conozca la URL.
 *
 * ⚠️ QUITAR este endpoint (y /setup-master) cuando Adrián confirme que su
 * cuenta ya es máster.
 */
const FOUNDER_EMAIL = "carrillomarinadrian673@gmail.com";

export async function POST(req: NextRequest) {
  const ctx = await resolveUser(req);
  if (!ctx.user) {
    return NextResponse.json(
      { error: "Primero inicia sesión en ZERO con Google y vuelve a esta página." },
      { status: 401 },
    );
  }
  if (normalizeEmail(ctx.user.email) !== FOUNDER_EMAIL) {
    return NextResponse.json({ error: "Esta página es solo para la cuenta fundadora." }, { status: 403 });
  }
  const ok = await promoteToMaster(FOUNDER_EMAIL);
  return ok
    ? NextResponse.json({ ok: true, detail: "Tu cuenta ya es la máster: activa para siempre y con acceso a /admin." })
    : NextResponse.json({ error: "No se pudo aplicar; inténtalo de nuevo." }, { status: 500 });
}
