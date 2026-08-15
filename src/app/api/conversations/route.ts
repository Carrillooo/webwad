import { NextRequest, NextResponse } from "next/server";
import { guardApi } from "@/lib/api-guard";
import { listConversations, clearConversations } from "@/lib/conversations/store";

export const runtime = "nodejs";

/** GET /api/conversations — historial de conversaciones del usuario. */
export async function GET(req: NextRequest) {
  const g = await guardApi(req);
  if (g.res) return g.res;
  return NextResponse.json({ conversations: await listConversations(g.ctx.userId) });
}

/** DELETE /api/conversations — borra todo el historial del usuario. */
export async function DELETE(req: NextRequest) {
  const g = await guardApi(req);
  if (g.res) return g.res;
  await clearConversations(g.ctx.userId);
  return NextResponse.json({ ok: true });
}
