import { NextRequest, NextResponse } from "next/server";
import { resolveUser, authRequired, type UserContext } from "./auth";
import { subscriptionOf, PLAN } from "./auth/users";

/**
 * Puerta de las APIs de pago: sin sesión → 401; con la prueba caducada → 402.
 *
 * Uso en cada ruta protegida:
 *   const g = await guardApi(req);
 *   if (g.res) return g.res;
 *   const { userId, authed } = g.ctx;
 */
export async function guardApi(
  req: NextRequest,
): Promise<{ ctx: UserContext; res: NextResponse | null }> {
  const ctx = await resolveUser(req);

  if (!ctx.authed && authRequired()) {
    return {
      ctx,
      res: NextResponse.json(
        { error: "Inicia sesión para usar ZERO.", code: "auth_required" },
        { status: 401 },
      ),
    };
  }

  if (ctx.user && subscriptionOf(ctx.user).status === "expired") {
    return {
      ctx,
      res: NextResponse.json(
        {
          error: `Tu prueba gratuita ha terminado. ${PLAN.name} cuesta ${PLAN.priceEur} €/mes; la pasarela de pago está al llegar.`,
          code: "subscription_required",
        },
        { status: 402 },
      ),
    };
  }

  return { ctx, res: null };
}
