import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveUser } from "@/lib/auth";
import { getStorage } from "@/lib/providers/storage";

/** GET /api/memory — list controlled memory items. */
export async function GET(req: NextRequest) {
  const { userId, authed } = await resolveUser(req);
  const items = await getStorage(authed).listMemories(userId);
  return NextResponse.json({ items, persisted: authed });
}

const AddBody = z.object({
  kind: z.enum(["preference", "fact", "note"]).default("preference"),
  key: z.string().max(120).optional(),
  value: z.string().min(1).max(2000),
});

/** POST /api/memory — remember_preference / add a memory item. */
export async function POST(req: NextRequest) {
  const parsed = AddBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "inválido" }, { status: 400 });
  const { userId, authed } = await resolveUser(req);
  const item = await getStorage(authed).addMemory(userId, parsed.data);
  return NextResponse.json({ item, persisted: authed });
}

/** DELETE /api/memory?id=... — forget_memory. */
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const { userId, authed } = await resolveUser(req);
  await getStorage(authed).removeMemory(userId, id);
  return NextResponse.json({ ok: true });
}
