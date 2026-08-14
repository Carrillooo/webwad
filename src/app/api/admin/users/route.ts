import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveUser } from "@/lib/auth";
import {
  listAllUsers,
  subscriptionOf,
  setSubscription,
  deleteUserCompletely,
} from "@/lib/auth/users";

export const runtime = "nodejs";

/** Solo la cuenta máster (is_owner) puede administrar. */
async function requireOwner(req: NextRequest) {
  const ctx = await resolveUser(req);
  if (!ctx.user?.isOwner) {
    return { res: NextResponse.json({ error: "Solo la cuenta máster." }, { status: 403 }) };
  }
  return { ctx };
}

/** GET /api/admin/users — todas las cuentas + métricas básicas. */
export async function GET(req: NextRequest) {
  const g = await requireOwner(req);
  if ("res" in g) return g.res;

  const users = (await listAllUsers()).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.displayName,
    isOwner: u.isOwner,
    createdAt: u.createdAt,
    subscription: subscriptionOf(u),
  }));
  const by = (s: string) => users.filter((u) => u.subscription.status === s).length;
  return NextResponse.json({
    users,
    stats: { total: users.length, activas: by("active"), prueba: by("trial"), caducadas: by("expired") },
  });
}

const Body = z.object({
  userId: z.string().min(1).max(80),
  action: z.enum(["activate", "revoke", "extend", "delete"]),
});

/** POST /api/admin/users — activar / revocar / regalar prueba / borrar cuenta. */
export async function POST(req: NextRequest) {
  const g = await requireOwner(req);
  if ("res" in g) return g.res;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  const { userId, action } = parsed.data;

  // La cuenta máster no se toca a sí misma: ni borrarse ni cortarse el acceso.
  if (userId === g.ctx.user!.id && action !== "extend") {
    return NextResponse.json({ error: "La cuenta máster no puede modificarse a sí misma." }, { status: 400 });
  }

  const ok =
    action === "delete" ? await deleteUserCompletely(userId) : await setSubscription(userId, action);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
}
