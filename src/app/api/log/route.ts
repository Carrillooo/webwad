import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { allowAttempt } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";

const Body = z.object({
  message: z.string().min(1).max(600),
  stack: z.string().max(2000).optional(),
  url: z.string().max(300).optional(),
});

/**
 * POST /api/log — errores de JavaScript del navegador.
 *
 * Sin esto, un fallo en el móvil de un cliente es invisible: aquí queda en los
 * logs de Vercel (Observability → Logs) con el prefijo [client-error], para
 * enterarnos ANTES de que lo cuente un cliente enfadado.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowAttempt(`clientlog:${ip}`, 10, 60_000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const { message, stack, url } = parsed.data;
  console.error(`[client-error] ${url ?? ""} :: ${message}${stack ? `\n${stack}` : ""}`);
  return NextResponse.json({ ok: true });
}
