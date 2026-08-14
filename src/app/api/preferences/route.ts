import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/api-guard";
import { getStorage } from "@/lib/providers/storage";

/** GET /api/preferences — returns stored prefs (or null in demo/local). */
export async function GET(req: NextRequest) {
  const g = await guardApi(req);
  if (g.res) return g.res;
  const { userId, authed } = g.ctx;
  const prefs = await getStorage(authed).getPreferences(userId);
  return NextResponse.json({ prefs, persisted: authed });
}

const Body = z.object({ prefs: z.record(z.string(), z.unknown()) });

/** PUT /api/preferences — persists prefs for authed users; no-op locally. */
export async function PUT(req: NextRequest) {
  const g = await guardApi(req);
  if (g.res) return g.res;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "inválido" }, { status: 400 });
  const { userId, authed } = g.ctx;
  await getStorage(authed).setPreferences(userId, parsed.data.prefs);
  return NextResponse.json({ ok: true, persisted: authed });
}
