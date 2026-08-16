import { NextRequest, NextResponse } from "next/server";
import { consumir, tramoDeRuta } from "@/lib/security/rate-limit";
import { logSeguridad, huellaCliente } from "@/lib/security/log";

/**
 * Puerta de entrada de TODAS las peticiones: cabeceras de seguridad, límite
 * de peticiones por tramo y bloqueo de peticiones cruzadas (CSRF).
 *
 * Va delante de las rutas, así que cubre incluso las que se añadan mañana:
 * ningún endpoint puede quedarse sin límite por olvido.
 */

/** Webhooks: los llama un tercero, se validan por FIRMA, no por origen. */
const WEBHOOKS = ["/api/twilio/", "/api/whatsapp/"];
/** Rutas públicas por diseño (las abren clientes de calendario o Google). */
const SIN_ORIGEN = [...WEBHOOKS, "/api/calendar/feed.ics", "/api/google/callback", "/api/microsoft/callback"];

function esWebhook(pathname: string): boolean {
  return WEBHOOKS.some((p) => pathname.startsWith(p));
}

/** IP del cliente detrás del proxy de Vercel. */
function ipDe(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/**
 * Identidad para contar peticiones: la sesión si la hay, si no la IP. Del
 * token de sesión solo se usa un trozo como huella — nunca se registra ni se
 * valida aquí (validarlo exige la base de datos).
 */
function identidad(req: NextRequest): string {
  const cookie = req.cookies.get("zero_session")?.value;
  if (cookie && cookie.length > 12) return `s:${cookie.slice(-12)}`;
  return `ip:${ipDe(req)}`;
}

/**
 * La política de contenido.
 *
 * Sin nonce a propósito: Next solo sella el nonce en páginas que se renderizan
 * en cada petición, y la portada de ZERO es estática (se genera al compilar).
 * Con nonce + strict-dynamic el navegador bloquearía TODOS los chunks y la web
 * se quedaría en blanco — está comprobado en navegador real.
 *
 * Lo que sí queda cerrado: no se puede cargar script de ningún otro dominio,
 * no hay plugins, no se puede meter la web en un iframe ajeno, no se puede
 * cambiar la base de las URLs ni enviar formularios fuera. Contra el XSS
 * inyectado la defensa real es React, que escapa todo lo que pinta.
 */
function construirCsp(dev: boolean): string {
  return [
    "default-src 'self'",
    // 'unsafe-inline' es obligatorio: Next arranca con scripts en línea
    // (self.__next_f.push) en las páginas estáticas. En desarrollo, además,
    // el recargado en caliente necesita eval.
    `script-src 'self' 'unsafe-inline' ${dev ? "'unsafe-eval'" : ""}`.trim(),
    // Tailwind y Next inyectan estilos en línea; no hay forma limpia de evitarlo.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // El audio de la voz llega como blob desde nuestra propia API.
    "media-src 'self' blob: data:",
    "connect-src 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/** Cabeceras que se ponen a TODAS las respuestas. */
function cabecerasSeguridad(res: NextResponse, csp: string, dev: boolean): NextResponse {
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (!dev) {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return res;
}

export function middleware(req: NextRequest) {
  const dev = process.env.NODE_ENV !== "production";
  const { pathname } = req.nextUrl;
  const csp = construirCsp(dev);
  const esApi = pathname.startsWith("/api/");

  if (esApi) {
    // 1) CSRF: una mutación solo puede venir de nuestra propia web. La cookie
    //    ya es sameSite=lax, esto es el segundo cerrojo.
    const muta = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";
    if (muta && !SIN_ORIGEN.some((p) => pathname.startsWith(p))) {
      const origen = req.headers.get("origin");
      if (origen) {
        const propio = `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("host") ?? ""}`;
        if (origen !== propio && new URL(origen).host !== req.headers.get("host")) {
          logSeguridad("origen.rechazado", { ruta: pathname, metodo: req.method, ip: huellaCliente(ipDe(req)) });
          return NextResponse.json(
            { error: "Petición rechazada por seguridad (origen no permitido)." },
            { status: 403 },
          );
        }
      }
    }

    // 2) Límite de peticiones por tramo.
    const tramo = tramoDeRuta(pathname);
    // Los webhooks se identifican por IP: no traen cookie nuestra.
    const clave = esWebhook(pathname) ? `ip:${ipDe(req)}` : identidad(req);
    const r = consumir(clave, tramo);
    if (!r.permitido) {
      logSeguridad("rate.limite", {
        ruta: pathname,
        tramo,
        ip: huellaCliente(ipDe(req)),
        limite: r.limite,
      });
      const res = NextResponse.json(
        {
          error:
            tramo === "auth"
              ? "Demasiados intentos. Vuelve a probar dentro de unos minutos."
              : "Has hecho demasiadas peticiones seguidas. Espera un momento y vuelve a intentarlo.",
          code: "rate_limited",
          retryAfter: r.reintentarEnS,
        },
        { status: 429 },
      );
      res.headers.set("Retry-After", String(r.reintentarEnS));
      res.headers.set("RateLimit-Limit", String(r.limite));
      res.headers.set("RateLimit-Remaining", "0");
      return cabecerasSeguridad(res, csp, dev);
    }

    const res = NextResponse.next();
    res.headers.set("RateLimit-Limit", String(r.limite));
    res.headers.set("RateLimit-Remaining", String(r.restantes));
    return cabecerasSeguridad(res, csp, dev);
  }

  return cabecerasSeguridad(NextResponse.next(), csp, dev);
}

export const config = {
  // Todo menos los ficheros estáticos (que sirve Vercel sin pasar por aquí).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|offline.html).*)"],
};
