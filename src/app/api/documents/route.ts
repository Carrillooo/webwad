import { NextRequest, NextResponse } from "next/server";
import { resolveProviders } from "@/lib/providers";
import { guardApi } from "@/lib/api-guard";

/** GET /api/documents?q=search — recent files, or search when q present. */
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q");
  const g = await guardApi(req);
  if (g.res) return g.res;
  const { userId, authed } = g.ctx;
  const providers = await resolveProviders(userId, authed);
  const files = q ? await providers.documents.searchFiles(q) : await providers.documents.recentFiles(10);
  return NextResponse.json({ files, demoMode: providers.demoMode });
}
