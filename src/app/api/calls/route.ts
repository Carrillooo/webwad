import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/api-guard";
import { placeCall } from "@/lib/twilio/place";
import { listCalls } from "@/lib/twilio/store";
import { requestOrigin } from "@/lib/http/origin";
import { allowAttempt } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";

const Body = z.object({
  to: z.string().min(6).max(20),
  contactName: z.string().max(80).optional(),
  goal: z.string().min(3).max(500),
});

/** POST /api/calls — inicia una llamada de ZERO (cuenta con sesión y plan vivo). */
export async function POST(req: NextRequest) {
  const g = await guardApi(req);
  if (g.res) return g.res;
  // Una llamada cuesta dinero: freno por usuario, no solo por IP.
  if (!allowAttempt(`call:${g.ctx.userId}`, 4, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Demasiadas llamadas seguidas. Espera unos minutos." },
      { status: 429 },
    );
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Petición inválida." }, { status: 400 });

  const r = await placeCall(g.ctx.userId, requestOrigin(req), parsed.data);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

/** GET /api/calls — últimas llamadas del usuario con su resultado. */
export async function GET(req: NextRequest) {
  const g = await guardApi(req);
  if (g.res) return g.res;
  const calls = await listCalls(g.ctx.userId, 10);
  return NextResponse.json({
    calls: calls.map((c) => ({
      id: c.id,
      to: c.toNumber,
      contactName: c.contactName,
      goal: c.goal,
      status: c.status,
      result: c.result,
      durationS: c.durationS,
      createdAt: c.createdAt,
    })),
  });
}
