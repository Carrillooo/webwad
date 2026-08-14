import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { promoteToMaster } from "@/lib/auth/users";

export const runtime = "nodejs";

const Body = z.object({ email: z.string().min(3).max(120) });

/**
 * POST /api/admin/promote — nombra máster a la cuenta con ese email
 * (activa para siempre) y retira la insignia a cualquier otra.
 *
 * Protegido con CRON_SECRET, como el reseteo: solo quien administra Vercel
 * puede usarlo. Sirve para cuando la cuenta buena no entró la primera.
 *
 *   curl -X POST https://TU-WEB/api/admin/promote \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"tu@email.com"}'
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) {
    return NextResponse.json({ error: "Define CRON_SECRET en Vercel." }, { status: 503 });
  }
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Falta el email." }, { status: 400 });

  const ok = await promoteToMaster(parsed.data.email);
  return ok
    ? NextResponse.json({ ok: true, detail: `${parsed.data.email} es ahora la cuenta máster.` })
    : NextResponse.json(
        { error: "No existe ninguna cuenta con ese email. Entra primero en la web con él y repite." },
        { status: 404 },
      );
}
