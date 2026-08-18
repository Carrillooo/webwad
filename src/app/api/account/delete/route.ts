import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/api-guard";
import { leerBody } from "@/lib/security/input";
import { deleteUserCompletely, SESSION_COOKIE } from "@/lib/auth/users";
import { logSeguridad, dominioDe } from "@/lib/security/log";

export const runtime = "nodejs";

/**
 * POST /api/account/delete — derecho de supresión (RGPD art. 17).
 *
 * Los Términos del servicio prometen «puedes borrar tu cuenta cuando quieras»
 * y hasta ahora eso NO era cierto: solo el administrador podía hacerlo desde
 * /admin. Una promesa incumplida en unos términos es justo lo que hace que te
 * denuncien.
 *
 * Es irreversible, así que se exige escribir la palabra exacta: un botón suelto
 * en Ajustes se pulsa sin querer, y de aquí no se vuelve.
 */
const Body = z.object({ confirmacion: z.literal("BORRAR") });

export async function POST(req: NextRequest) {
  const g = await guardApi(req);
  if (g.res) return g.res;
  const { userId, authed, user } = g.ctx;

  if (!authed || !user) {
    return NextResponse.json(
      { error: "Necesitas haber iniciado sesión para borrar tu cuenta." },
      { status: 401 },
    );
  }

  const body = await leerBody(req, Body);
  if (!body.ok) return body.res;

  let borrada = false;
  try {
    borrada = await deleteUserCompletely(userId);
  } catch (e) {
    console.error("no se pudo borrar la cuenta", e);
    return NextResponse.json(
      { error: "No se pudo borrar la cuenta ahora mismo. Inténtalo en un momento." },
      { status: 503 },
    );
  }

  if (!borrada) {
    return NextResponse.json({ error: "Esa cuenta ya no existe." }, { status: 404 });
  }

  // Del email solo el dominio: en un registro de seguridad no pinta más.
  logSeguridad("acceso.denegado", { ruta: "/api/account/delete", motivo: "cuenta borrada por su dueño", dominio: dominioDe(user.email) });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
