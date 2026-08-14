import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { database, isDatabaseConfigured } from "../db/server";

/**
 * Cuentas propias de ZERO (multiusuario).
 *
 * Cada persona se registra con email y contraseña, y TODO lo suyo (conexión de
 * Google/Outlook, memoria, preferencias, push) cuelga de su id. Sin cuentas,
 * todos los visitantes compartían al dueño único — inaceptable para vender la
 * app: cualquiera veía el calendario y el Drive del asistente.
 *
 * Sin base de datos (desarrollo local) todo funciona igual en memoria.
 */

export const SESSION_COOKIE = "zero_session";

/** El único plan. La pasarela de pago llegará después; el precio ya es real. */
export const PLAN = {
  name: "ZERO Pro",
  priceEur: 20,
  trialDays: 14,
} as const;

const SESSION_DAYS = 60;

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  /** 'active' no caduca; 'trial' caduca en trialEndsAt. */
  subscriptionStatus: "trial" | "active";
  trialEndsAt: string | null;
  isOwner: boolean;
  createdAt: string;
}

export interface Subscription {
  status: "active" | "trial" | "expired";
  /** Días de prueba restantes (solo en 'trial'). */
  daysLeft: number | null;
  trialEndsAt: string | null;
}

export type RegisterError = "email_invalido" | "password_corta" | "nombre_vacio" | "email_en_uso";

interface StoredUser extends AuthUser {
  /** Vacío en cuentas creadas con "Continuar con Google/Microsoft". */
  passwordHash: string;
}

// ------------------------------ almacenamiento ------------------------------

const g = globalThis as unknown as {
  __zeroAuthUsers?: Map<string, StoredUser>; // email → user
  __zeroAuthSessions?: Map<string, { userId: string; expiresAt: number }>; // tokenHash → sesión
};
function memUsers() {
  if (!g.__zeroAuthUsers) g.__zeroAuthUsers = new Map();
  return g.__zeroAuthUsers;
}
function memSessions() {
  if (!g.__zeroAuthSessions) g.__zeroAuthSessions = new Map();
  return g.__zeroAuthSessions;
}

// ------------------------------- contraseñas --------------------------------

/** scrypt con sal aleatoria; formato v1:sal:hash (base64). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `v1:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  // Cuentas OAuth (sin contraseña): jamás entran por aquí con éxito.
  const [v, saltB64, hashB64] = stored.split(":");
  if (v !== "v1" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const got = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// -------------------------------- validación --------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function rowToUser(r: Record<string, unknown>): StoredUser {
  return {
    id: String(r.id),
    email: String(r.email),
    displayName: String(r.display_name),
    passwordHash: r.password_hash == null ? "" : String(r.password_hash),
    subscriptionStatus: r.subscription_status === "active" ? "active" : "trial",
    trialEndsAt: r.trial_ends_at ? new Date(r.trial_ends_at as string | Date).toISOString() : null,
    isOwner: Boolean(r.is_owner),
    createdAt: r.created_at ? new Date(r.created_at as string | Date).toISOString() : new Date().toISOString(),
  };
}

/** La versión sin hash, apta para respuestas de API. */
export function publicUser(u: StoredUser | AuthUser): AuthUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    subscriptionStatus: u.subscriptionStatus,
    trialEndsAt: u.trialEndsAt,
    isOwner: u.isOwner,
    createdAt: u.createdAt,
  };
}

// -------------------------------- suscripción -------------------------------

export function subscriptionOf(user: AuthUser, now = new Date()): Subscription {
  if (user.subscriptionStatus === "active") {
    return { status: "active", daysLeft: null, trialEndsAt: null };
  }
  const ends = user.trialEndsAt ? new Date(user.trialEndsAt).getTime() : 0;
  const msLeft = ends - now.getTime();
  if (msLeft <= 0) return { status: "expired", daysLeft: 0, trialEndsAt: user.trialEndsAt };
  return {
    status: "trial",
    daysLeft: Math.ceil(msLeft / 86_400_000),
    trialEndsAt: user.trialEndsAt,
  };
}

// --------------------------------- registro ---------------------------------

async function countUsers(): Promise<number> {
  if (isDatabaseConfigured()) {
    const sql = await database();
    const rows = await sql`select count(*)::int as n from auth_users`;
    return Number((rows[0] as { n: number }).n);
  }
  return memUsers().size;
}

export async function findByEmail(email: string): Promise<StoredUser | null> {
  const norm = normalizeEmail(email);
  if (isDatabaseConfigured()) {
    const sql = await database();
    const rows = await sql`select * from auth_users where email = ${norm} limit 1`;
    return rows[0] ? rowToUser(rows[0] as Record<string, unknown>) : null;
  }
  return memUsers().get(norm) ?? null;
}

export async function registerUser(
  email: string,
  password: string,
  displayName: string,
): Promise<{ user: AuthUser } | { error: RegisterError }> {
  const norm = normalizeEmail(email);
  const name = displayName.trim();
  if (!EMAIL_RE.test(norm)) return { error: "email_invalido" };
  if (password.length < 8) return { error: "password_corta" };
  if (!name) return { error: "nombre_vacio" };
  if (await findByEmail(norm)) return { error: "email_en_uso" };

  const first = (await countUsers()) === 0;
  const user: StoredUser = {
    id: randomBytes(16).toString("hex"),
    email: norm,
    displayName: name.slice(0, 60),
    passwordHash: hashPassword(password),
    // La primera cuenta es la del fundador: activa para siempre. Las demás
    // empiezan con la prueba gratuita del plan.
    subscriptionStatus: first ? "active" : "trial",
    trialEndsAt: first ? null : new Date(Date.now() + PLAN.trialDays * 86_400_000).toISOString(),
    isOwner: first,
    createdAt: new Date().toISOString(),
  };

  if (isDatabaseConfigured()) {
    const sql = await database();
    // El perfil primero: todas las tablas de datos referencian profiles(id).
    await sql`
      insert into profiles (id, display_name) values (${user.id}, ${user.displayName})
      on conflict (id) do update set display_name = excluded.display_name, updated_at = now()
    `;
    try {
      await sql`
        insert into auth_users (id, email, password_hash, display_name, subscription_status, trial_ends_at, is_owner)
        values (${user.id}, ${user.email}, ${user.passwordHash}, ${user.displayName},
                ${user.subscriptionStatus}, ${user.trialEndsAt}, ${user.isOwner})
      `;
    } catch (e) {
      // Carrera entre dos registros con el mismo email: el unique manda.
      if (String(e).includes("auth_users_email_key") || String(e).includes("duplicate")) {
        return { error: "email_en_uso" };
      }
      throw e;
    }
  } else {
    memUsers().set(norm, user);
  }

  return { user: publicUser(user) };
}

/**
 * Entrar (o crear cuenta) con Google/Microsoft: busca por email y, si no
 * existe, crea la cuenta sin contraseña. La lógica de fundador y herencia es
 * la misma que en el registro normal.
 */
export async function findOrCreateOAuthUser(
  email: string,
  displayName: string,
): Promise<{ user: AuthUser } | { error: RegisterError }> {
  const norm = normalizeEmail(email);
  if (!EMAIL_RE.test(norm)) return { error: "email_invalido" };
  const existing = await findByEmail(norm);
  if (existing) return { user: publicUser(existing) };

  const name = (displayName.trim() || norm.split("@")[0]).slice(0, 60);
  const first = (await countUsers()) === 0;
  const user: StoredUser = {
    id: randomBytes(16).toString("hex"),
    email: norm,
    displayName: name,
    passwordHash: "",
    subscriptionStatus: first ? "active" : "trial",
    trialEndsAt: first ? null : new Date(Date.now() + PLAN.trialDays * 86_400_000).toISOString(),
    isOwner: first,
    createdAt: new Date().toISOString(),
  };

  if (isDatabaseConfigured()) {
    const sql = await database();
    await sql`
      insert into profiles (id, display_name) values (${user.id}, ${user.displayName})
      on conflict (id) do update set display_name = excluded.display_name, updated_at = now()
    `;
    try {
      await sql`
        insert into auth_users (id, email, password_hash, display_name, subscription_status, trial_ends_at, is_owner)
        values (${user.id}, ${user.email}, ${null}, ${user.displayName},
                ${user.subscriptionStatus}, ${user.trialEndsAt}, ${user.isOwner})
      `;
    } catch (e) {
      // Carrera: otro registro con el mismo email ganó. Usa esa cuenta.
      if (String(e).includes("auth_users_email_key") || String(e).includes("duplicate")) {
        const winner = await findByEmail(norm);
        if (winner) return { user: publicUser(winner) };
      }
      throw e;
    }
  } else {
    memUsers().set(norm, user);
  }

  return { user: publicUser(user) };
}

export async function verifyLogin(email: string, password: string): Promise<AuthUser | null> {
  const stored = await findByEmail(email);
  // Coste constante también cuando el email no existe.
  const hash = stored?.passwordHash ?? hashPassword("relleno-para-tiempo-constante");
  const ok = verifyPassword(password, hash);
  return ok && stored ? publicUser(stored) : null;
}

// --------------------------------- sesiones ---------------------------------

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  if (isDatabaseConfigured()) {
    const sql = await database();
    await sql`insert into auth_sessions (token_hash, user_id, expires_at) values (${tokenHash(token)}, ${userId}, ${expiresAt})`;
  } else {
    memSessions().set(tokenHash(token), { userId, expiresAt: expiresAt.getTime() });
  }
  return { token, expiresAt };
}

export async function getUserBySession(token: string): Promise<AuthUser | null> {
  if (!token) return null;
  const hash = tokenHash(token);
  if (isDatabaseConfigured()) {
    const sql = await database();
    const rows = await sql`
      select u.* from auth_sessions s join auth_users u on u.id = s.user_id
      where s.token_hash = ${hash} and s.expires_at > now() limit 1
    `;
    return rows[0] ? publicUser(rowToUser(rows[0] as Record<string, unknown>)) : null;
  }
  const s = memSessions().get(hash);
  if (!s || s.expiresAt <= Date.now()) {
    memSessions().delete(hash);
    return null;
  }
  for (const u of memUsers().values()) if (u.id === s.userId) return publicUser(u);
  return null;
}

export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  const hash = tokenHash(token);
  if (isDatabaseConfigured()) {
    const sql = await database();
    await sql`delete from auth_sessions where token_hash = ${hash}`;
    return;
  }
  memSessions().delete(hash);
}

// ---------------------------- administración --------------------------------

/** Todas las cuentas, para el panel /admin (solo cuenta máster). */
export async function listAllUsers(): Promise<AuthUser[]> {
  if (isDatabaseConfigured()) {
    const sql = await database();
    const rows = await sql`select * from auth_users order by created_at asc`;
    return (rows as unknown as Record<string, unknown>[]).map(rowToUser).map(publicUser);
  }
  return [...memUsers().values()].map(publicUser);
}

export type AdminAction = "activate" | "revoke" | "extend";

/** Cambia la suscripción de una cuenta desde el panel:
 *  activate = de pago para siempre · revoke = corta el acceso ya ·
 *  extend = regala otros 14 días de prueba. */
export async function setSubscription(userId: string, action: AdminAction): Promise<boolean> {
  const status = action === "activate" ? "active" : "trial";
  const trialEnds =
    action === "activate"
      ? null
      : action === "extend"
        ? new Date(Date.now() + PLAN.trialDays * 86_400_000)
        : new Date(0); // revoke: prueba caducada desde ya
  if (isDatabaseConfigured()) {
    const sql = await database();
    const rows = await sql`
      update auth_users set subscription_status = ${status}, trial_ends_at = ${trialEnds}
      where id = ${userId} returning id
    `;
    return rows.length > 0;
  }
  for (const u of memUsers().values()) {
    if (u.id === userId) {
      u.subscriptionStatus = status;
      u.trialEndsAt = trialEnds ? trialEnds.toISOString() : null;
      return true;
    }
  }
  return false;
}

/** Borra la cuenta y TODOS sus datos (perfil, conexiones, memoria, sesiones). */
export async function deleteUserCompletely(userId: string): Promise<boolean> {
  if (isDatabaseConfigured()) {
    const sql = await database();
    // profiles cascada sobre todas las tablas de datos y sobre auth_users.
    const rows = await sql`delete from profiles where id = ${userId} returning id`;
    return rows.length > 0;
  }
  for (const [email, u] of memUsers()) {
    if (u.id === userId) {
      memUsers().delete(email);
      for (const [hash, s] of memSessions()) if (s.userId === userId) memSessions().delete(hash);
      return true;
    }
  }
  return false;
}

/**
 * Borrado TOTAL: deja la base como recién creada, sin ninguna cuenta.
 * La siguiente persona que entre (con Google o registro) será la fundadora.
 */
export async function wipeAllData(): Promise<void> {
  if (isDatabaseConfigured()) {
    const sql = await database();
    // profiles arrastra en cascada todas las tablas de datos y auth_users.
    await sql`delete from profiles`;
    await sql`delete from auth_sessions`;
    await sql`delete from auth_users`;
    return;
  }
  g.__zeroAuthUsers = new Map();
  g.__zeroAuthSessions = new Map();
}

// ----------------------------- para los crons -------------------------------

/** Cuentas a las que los crons pueden enviar avisos (activas o en prueba). */
export async function listBillableUsers(): Promise<AuthUser[]> {
  let users: StoredUser[];
  if (isDatabaseConfigured()) {
    const sql = await database();
    const rows = await sql`select * from auth_users`;
    users = (rows as unknown as Record<string, unknown>[]).map(rowToUser);
  } else {
    users = [...memUsers().values()];
  }
  return users.map(publicUser).filter((u) => subscriptionOf(u).status !== "expired");
}
