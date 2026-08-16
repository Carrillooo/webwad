import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveProviders } from "@/lib/providers";
import { guardApi } from "@/lib/api-guard";
import { leerQuery } from "@/lib/security/input";

/** GET /api/documents?q=search — recent files, or search when q present. */
export async function GET(req: NextRequest) {
  // La búsqueda viaja a la API de Drive: se acota antes de salir de aquí.
  const parsed = leerQuery(req, z.object({ q: z.string().min(1).max(200).optional() }));
  if (!parsed.ok) return parsed.res;
  const q = parsed.data.q;
  const g = await guardApi(req);
  if (g.res) return g.res;
  const { userId, authed } = g.ctx;
  const providers = await resolveProviders(userId, authed);
  const files = q ? await providers.documents.searchFiles(q) : await providers.documents.recentFiles(10);
  return NextResponse.json({ files, demoMode: providers.demoMode });
}
