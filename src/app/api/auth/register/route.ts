import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  registerUser,
  registrationProblem,
  findByEmail,
  createSession,
  SESSION_COOKIE,
  subscriptionOf,
  PLAN,
} from "@/lib/auth/users";
import { createVerification, verifyCode } from "@/lib/auth/verification";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { requestOrigin } from "@/lib/http/origin";
import { isSmtpConfigured } from "@/lib/config";
import { sendMail } from "@/lib/mail/send";

const Body = z.object({
  email: z.string().max(120),
  password: z.string().max(200),
  name: z.string().max(80),
  /** La casilla de términos: sin ella no hay cuenta, lo valida el servidor. */
  acceptTerms: z.boolean().optional(),
  /** Presente en el segundo paso (verificación del email). */
  code: z.string().max(10).optional(),
});

const ERRORES: Record<string, string> = {
  email_invalido: "Ese email no parece válido.",
  password_corta: "La contraseña necesita al menos 8 caracteres.",
  nombre_vacio: "Dinos tu nombre: es como te llamará ZERO.",
  email_en_uso: "Ya existe una cuenta con ese email. Inicia sesión.",
  codigo_incorrecto: "El código no es correcto. Revísalo y prueba otra vez.",
  codigo_caducado: "El código ha caducado o se agotaron los intentos. Pide uno nuevo.",
};

/**
 * POST /api/auth/register — crear cuenta en dos pasos.
 *
 * 1) Sin `code`: valida los datos y la casilla de términos, y si hay correo
 *    configurado envía un código de 6 dígitos al email → { pending: true }.
 * 2) Con `code`: verifica el código y crea la cuenta con sesión iniciada.
 * Sin SMTP configurado (desarrollo), se salta la verificación con honestidad.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowAttempt(`reg:${ip}`, 6, 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un minuto." }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  const { email, password, name, acceptTerms, code } = parsed.data;

  // Los términos se aceptan SÍ o SÍ: el servidor no se fía solo del botón.
  if (!acceptTerms) {
    return NextResponse.json(
      { error: "Tienes que aceptar los Términos y la Política de privacidad para crear la cuenta." },
      { status: 400 },
    );
  }

  try {
    // Paso 1 — validar y mandar el código (solo si hay correo configurado).
    if (!code) {
      const problem = registrationProblem(email, password, name);
      if (problem) return NextResponse.json({ error: ERRORES[problem] }, { status: 400 });
      if (await findByEmail(email)) {
        return NextResponse.json({ error: ERRORES.email_en_uso }, { status: 400 });
      }
      if (isSmtpConfigured()) {
        if (!allowAttempt(`code:${email.trim().toLowerCase()}`, 3, 60_000)) {
          return NextResponse.json({ error: "Código ya enviado. Espera un minuto para pedir otro." }, { status: 429 });
        }
        const verification = await createVerification(email);
        const sent = await sendMail({
          to: email.trim(),
          subject: `${verification} es tu código de ZERO`,
          body:
            `Hola ${name.trim()},\n\n` +
            `Tu código para crear la cuenta en ZERO es: ${verification}\n\n` +
            `Caduca en 10 minutos. Si no has sido tú, ignora este correo.\n\n— ZERO`,
          senderName: "ZERO",
        });
        if (!sent.ok) {
          console.error("no se pudo enviar el código:", sent.detail);
          return NextResponse.json(
            { error: "No pudimos enviarte el código por correo. Inténtalo en un momento." },
            { status: 502 },
          );
        }
        return NextResponse.json({ pending: true });
      }
      // Sin SMTP (desarrollo local): crear directamente, sin fingir que se verificó.
    }

    // Paso 2 — verificar el código (cuando aplica) y crear la cuenta.
    if (code && isSmtpConfigured()) {
      const v = await verifyCode(email, code);
      if (v !== "ok") return NextResponse.json({ error: ERRORES[v] }, { status: 400 });
    }

    const out = await registerUser(email, password, name);
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
  } catch (e) {
    console.error("registro falló (¿base de datos caída?)", e);
    return NextResponse.json(
      { error: "No se pudo crear la cuenta ahora mismo (base de datos no disponible). Inténtalo en un momento." },
      { status: 503 },
    );
  }
}
