import { NextRequest, NextResponse } from "next/server";
import { resolveUser, authRequired } from "@/lib/auth";
import { subscriptionOf, PLAN } from "@/lib/auth/users";
import { serverConfig } from "@/lib/config";
import { isGoogleConfigured } from "@/lib/google/oauth";
import { isMicrosoftConfigured } from "@/lib/microsoft/oauth";

/** GET /api/auth/me — quién soy y en qué estado está mi suscripción.
 *  La UI decide con esto si enseña la app, el login o el muro del plan. */
export async function GET(req: NextRequest) {
  const ctx = await resolveUser(req);
  return NextResponse.json({
    authRequired: authRequired(),
    demoMode: serverConfig.demoMode,
    plan: PLAN,
    // Con qué se puede entrar además de email+contraseña.
    oauth: { google: isGoogleConfigured(), microsoft: isMicrosoftConfigured() },
    account: ctx.user
      ? {
          id: ctx.user.id,
          email: ctx.user.email,
          name: ctx.user.displayName,
          isOwner: ctx.user.isOwner,
          subscription: subscriptionOf(ctx.user),
          plan: PLAN,
        }
      : null,
  });
}
