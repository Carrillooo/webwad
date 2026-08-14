import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerUser, createSession, SESSION_COOKIE, subscriptionOf, PLAN } from "@/lib/auth/users";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { requestOrigin } from "@/lib/http/origin";

const Body = z.object({
  email: z.string().max(120),
  password: z.string().max(200),
  name: z.string().max(80),
});

const ERRORES: Record<string, string> = {
  email_invalido: "Ese email no parece válido.",
  password_corta: "La contraseña necesita al menos 8 caracteres.",
  nombre_vacio: "Dinos tu nombre: es como te llamará ZERO.",
  email_en_uso: "Ya existe una cuenta con ese email. Inicia sesión.",
};

/** POST /api/auth/register — crea la cuenta e inicia sesión de una vez. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowAttempt(`reg:${ip}`, 6, 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un minuto." }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Petición inválida." }, { status: 400 });

  let out: Awaited<ReturnType<typeof registerUser>>;
  try {
    out = await registerUser(parsed.data.email, parsed.data.password, parsed.data.name);
  } catch (e) {
    console.error("registro falló (¿base de datos caída?)", e);
    return NextResponse.json(
      { error: "No se pudo crear la cuenta ahora mismo (base de datos no disponible). Inténtalo en un momento." },
      { status: 503 },
    );
  }
  if ("error" in out) {
    return NextResponse.json({ error: ERRORES[out.error] ?? out.error }, { status: 400 });
  }

  const { token, expiresAt } = await createSession(out.user.id);
  const res = NextResponse.json({
    account: {
      id: out.user.id,
      email: out.user.email,
      name: out.user.displayName,
      isOwner: out.user.isOwner,
      subscription: subscriptionOf(out.user),
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
