import { NextRequest } from "next/server";
import { serverConfig } from "./config";
import { isDatabaseConfigured } from "./db/server";
import { getUserBySession, SESSION_COOKIE, type AuthUser } from "./auth/users";

/** Stable id for the unauthenticated demo fallback. */
export const DEMO_USER_ID = "demo-user";

export interface UserContext {
  userId: string;
  /** true cuando hay una sesión iniciada (los datos van a la base por usuario). */
  authed: boolean;
  /** La cuenta, cuando hay sesión. */
  user?: AuthUser;
}

/**
 * Resuelve al usuario por su cookie de sesión. Cada cuenta ve SOLO lo suyo:
 * su Google, su Outlook, su memoria. Sin sesión se cae al usuario demo en
 * memoria, que en producción no puede usar la app (ver authRequired).
 */
export async function resolveUser(req: NextRequest): Promise<UserContext> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const user = await getUserBySession(token);
      if (user) return { userId: user.id, authed: true, user };
    } catch {
      /* base de datos caída → tratar como sin sesión */
    }
  }
  return { userId: DEMO_USER_ID, authed: false };
}

/**
 * ¿Exigimos cuenta? En producción (hay base de datos y no es demo), sí:
 * la app es de pago. En desarrollo sin base, todo queda abierto en demo.
 */
export function authRequired(): boolean {
  return isDatabaseConfigured() && !serverConfig.demoMode;
}
