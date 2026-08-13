import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveUser } from "@/lib/auth";
import { pushToUser } from "@/lib/push/send";
import { isPushConfigured } from "@/lib/config";

const Body = z.object({
  title: z.string().max(120).default("ZERO"),
  body: z.string().max(300).default(""),
  url: z.string().optional(),
});

/** POST /api/push/send — send a notification to the user's devices.
 *  Used for reminders ("Entrenamiento en 30 minutos") and testing. */
export async function POST(req: NextRequest) {
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Push no configurado." }, { status: 400 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "inválido" }, { status: 400 });

  const { userId, authed } = await resolveUser(req);
  const { sent, total } = await pushToUser(userId, authed, parsed.data);
  return NextResponse.json({ ok: true, sent, total });
}
