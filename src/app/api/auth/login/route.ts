import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyLogin, createSession, SESSION_COOKIE, subscriptionOf, PLAN } from "@/lib/auth/users";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { requestOrigin } from "@/lib/http/origin";
import { logSeguridad, huellaCliente, dominioDe } from "@/lib/security/log";

const Body = z.object({ email: z.string().max(120), password: z.string().max(200) });

/** POST /api/auth/login — inicia sesión con email y contraseña. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  // Además del límite global del middleware (5 intentos / 15 min), este
  // frena en seco las ráfagas de un segundo.
  if (!allowAttempt(`login:${ip}`, 10, 60_000)) {
    logSeguridad("auth.bloqueo", { ruta: "/api/auth/login", ip: huellaCliente(ip) });
    return NextResponse.json({ error: "Demasiados intentos. Espera un minuto." }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Petición inválida." }, { status: 400 });

  let user: Awaited<ReturnType<typeof verifyLogin>>;
  try {
    user = await verifyLogin(parsed.data.email, parsed.data.password);
  } catch (e) {
    console.error("login falló (¿base de datos caída?)", e);
    return NextResponse.json(
      { error: "No se pudo comprobar la cuenta ahora mismo (base de datos no disponible). Inténtalo en un momento." },
      { status: 503 },
    );
  }
  if (!user) {
    // Solo el dominio: el email completo es dato personal y no pinta en un log.
    logSeguridad("auth.fallo", { ruta: "/api/auth/login", dominio: dominioDe(parsed.data.email), ip: huellaCliente(ip) });
    return NextResponse.json({ error: "Email o contraseña incorrectos." }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(user.id);
  const res = NextResponse.json({
    account: {
      id: user.id,
      email: user.email,
      name: user.displayName,
      isOwner: user.isOwner,
      subscription: subscriptionOf(user),
      plan: PLAN,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: requestOrigin(req).startsWith("https"),
    path: "/",
    expires: expiresAt,
  });
  return res;
}
