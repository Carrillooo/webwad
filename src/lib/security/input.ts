import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { logSeguridad } from "./log";

/**
 * Validación de entradas con Zod para TODO lo que manda el usuario: cuerpo de
 * la petición y también parámetros de la URL, que es por donde se cuelan los
 * intentos de inyección más tontos (y los que más funcionan).
 *
 * Todo lo que no pasa la validación se rechaza con 400 y se anota en el
 * registro de seguridad — sin el valor, solo qué campo falló: el propio
 * intento de inyección no debe quedar escrito en los logs.
 */

/** Devuelve la respuesta 400 y deja rastro. */
function rechazo(ruta: string, campos: string[]): NextResponse {
  logSeguridad("input.rechazado", { ruta, campos: campos.slice(0, 6).join(",") || "(cuerpo)" });
  return NextResponse.json({ error: "Petición inválida.", code: "invalid_input" }, { status: 400 });
}

type Resultado<T> = { ok: true; data: T } | { ok: false; res: NextResponse };

/** Valida los parámetros de la URL (?a=1&b=2) contra un esquema. */
export function leerQuery<T extends z.ZodTypeAny>(
  req: NextRequest,
  esquema: T,
): Resultado<z.infer<T>> {
  const crudo: Record<string, string> = {};
  for (const [k, v] of req.nextUrl.searchParams) crudo[k] = v;
  const parsed = esquema.safeParse(crudo);
  if (!parsed.success) {
    return { ok: false, res: rechazo(req.nextUrl.pathname, parsed.error.issues.map((i) => i.path.join("."))) };
  }
  return { ok: true, data: parsed.data };
}

/** Valida el cuerpo JSON contra un esquema. Un JSON roto también se rechaza. */
export async function leerBody<T extends z.ZodTypeAny>(
  req: NextRequest,
  esquema: T,
): Promise<Resultado<z.infer<T>>> {
  const json = await req.json().catch(() => null);
  const parsed = esquema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, res: rechazo(req.nextUrl.pathname, parsed.error.issues.map((i) => i.path.join("."))) };
  }
  return { ok: true, data: parsed.data };
}
