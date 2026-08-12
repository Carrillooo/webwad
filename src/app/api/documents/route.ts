import { NextRequest, NextResponse } from "next/server";
import { getProviders } from "@/lib/providers";

/** GET /api/documents?q=search — recent files, or search when q present. */
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q");
  const providers = getProviders();
  const files = q ? await providers.documents.searchFiles(q) : await providers.documents.recentFiles(10);
  return NextResponse.json({ files, demoMode: providers.demoMode });
}
