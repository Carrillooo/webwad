import { NextResponse } from "next/server";
import { computeCapabilities, serverConfig, isPushConfigured } from "@/lib/config";
import { isGoogleConfigured } from "@/lib/google/oauth";
import { isSupabaseConfigured } from "@/lib/supabase/server";

/** GET /api/health — liveness + high-level readiness (no secrets). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    demoMode: serverConfig.demoMode,
    google: isGoogleConfigured(),
    supabase: isSupabaseConfigured(),
    anthropic: serverConfig.anthropic.apiKey.length > 0,
    push: isPushConfigured(),
    capabilities: computeCapabilities().map((c) => ({ key: c.key, status: c.status })),
  });
}
