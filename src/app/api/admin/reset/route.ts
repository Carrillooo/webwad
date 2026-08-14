import { NextRequest, NextResponse } from "next/server";
import { wipeAllData } from "@/lib/auth/users";

export const runtime = "nodejs";

/**
 * POST /api/admin/reset — BORRADO TOTAL de cuentas y datos.
 *
 * Deja la base de datos como recién estrenada: sin cuentas (tampoco la del
 * dueño anterior), sin conexiones, sin memoria. La siguiente persona que
 * entre —con Google o registro normal— será la cuenta máster.
 *
 * Protegido con el secreto del servidor (CRON_SECRET): solo quien administra
 * Vercel puede dispararlo. Pensado para estrenar la app limpia; con clientes
 * reales, NO usar.
 *
 *   curl -X POST https://TU-WEB/api/admin/reset -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) {
    return NextResponse.json(
      { error: "Define CRON_SECRET en Vercel para poder usar el reseteo." },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    await wipeAllData();
    return NextResponse.json({
      ok: true,
      detail: "Todo borrado. La primera cuenta que entre ahora será la máster.",
    });
  } catch (e) {
    console.error("reset falló", e);
    return NextResponse.json({ error: "El borrado falló; mira los logs." }, { status: 500 });
  }
}
