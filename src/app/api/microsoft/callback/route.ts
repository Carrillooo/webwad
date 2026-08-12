import { NextRequest, NextResponse } from "next/server";
import { exchangeMsCode, fetchMsEmail } from "@/lib/microsoft/oauth";
import { verifyState } from "@/lib/google/state";
import { saveMsConnection } from "@/lib/microsoft/connection";
import { serverConfig } from "@/lib/config";

/** GET /api/microsoft/callback — OAuth redirect target. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const err = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const home = new URL("/", serverConfig.appUrl);

  if (err || !code || !state) {
    home.searchParams.set("microsoft", err ? "error" : "invalid");
    return NextResponse.redirect(home);
  }
  const parsed = verifyState(state);
  if (!parsed) {
    home.searchParams.set("microsoft", "badstate");
    return NextResponse.redirect(home);
  }
  try {
    const tokens = await exchangeMsCode(code);
    const email = await fetchMsEmail(tokens.accessToken);
    await saveMsConnection(parsed.uid, parsed.authed, tokens, email);
    home.searchParams.set("microsoft", "connected");
  } catch (e) {
    console.error("microsoft callback error", e);
    home.searchParams.set("microsoft", "error");
  }
  return NextResponse.redirect(home);
}
