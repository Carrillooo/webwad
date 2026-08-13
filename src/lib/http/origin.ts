import type { NextRequest } from "next/server";
import { serverConfig } from "../config";

/**
 * De dónde viene realmente la petición.
 *
 * Los callbacks de OAuth tienen que devolverte a la web desde la que saliste.
 * Usar APP_URL para eso es frágil: si no está puesta en Vercel, el valor por
 * defecto es http://localhost:3000 y acabas en "Safari no puede conectarse al
 * servidor" después de un login que sí funcionó.
 *
 * Detrás de un proxy (Vercel) el host real viaja en x-forwarded-*.
 */
export function requestOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto =
      req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return req.nextUrl?.origin || serverConfig.appUrl;
}

/** La home de la app, en el mismo sitio del que vino la petición. */
export function appHome(req: NextRequest): URL {
  return new URL("/", requestOrigin(req));
}
