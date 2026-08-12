import { NextResponse } from "next/server";
import { computeCapabilities, serverConfig } from "@/lib/config";

/** GET /api/capabilities — setup wizard status. Never returns secrets. */
export async function GET() {
  return NextResponse.json({
    demoMode: serverConfig.demoMode,
    capabilities: computeCapabilities(),
  });
}
