import { createHash, randomInt } from "node:crypto";
import { database, isDatabaseConfigured } from "../db/server";
import { normalizeEmail } from "./users";

/**
 * Códigos de verificación del email al crear cuenta (6 dígitos, 10 minutos).
 * Se guardan HASHEADOS: ni la base de datos sabe el código. Máximo 5 intentos
 * por código; al quinto fallo se invalida y hay que pedir otro.
 */

const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

const g = globalThis as unknown as {
  __zeroEmailCodes?: Map<string, { codeHash: string; attempts: number; expiresAt: number }>;
};
function memCodes() {
  if (!g.__zeroEmailCodes) g.__zeroEmailCodes = new Map();
  return g.__zeroEmailCodes;
}

function hash(email: string, code: string): string {
  return createHash("sha256").update(`${email}:${code}`).digest("hex");
}

/** Crea (o sustituye) el código de un email y lo devuelve para enviarlo. */
export async function createVerification(email: string): Promise<string> {
  const norm = normalizeEmail(email);
  const code = String(randomInt(100000, 1000000)); // siempre 6 dígitos
  const codeHash = hash(norm, code);
  const expiresAt = new Date(Date.now() + TTL_MS);
  if (isDatabaseConfigured()) {
    const sql = await database();
    await sql`
      insert into email_verifications (email, code_hash, attempts, expires_at)
      values (${norm}, ${codeHash}, 0, ${expiresAt})
      on conflict (email) do update
        set code_hash = excluded.code_hash, attempts = 0, expires_at = excluded.expires_at, created_at = now()
    `;
  } else {
    memCodes().set(norm, { codeHash, attempts: 0, expiresAt: expiresAt.getTime() });
  }
  return code;
}

export type VerifyResult = "ok" | "codigo_incorrecto" | "codigo_caducado";

/** Comprueba el código; si es correcto lo consume (un solo uso). */
export async function verifyCode(email: string, code: string): Promise<VerifyResult> {
  const norm = normalizeEmail(email);
  const codeHash = hash(norm, code.trim());
  if (isDatabaseConfigured()) {
    const sql = await database();
    const rows = await sql`select code_hash, attempts, expires_at from email_verifications where email = ${norm} limit 1`;
    const r = rows[0] as { code_hash: string; attempts: number; expires_at: string | Date } | undefined;
    if (!r || new Date(r.expires_at).getTime() <= Date.now()) return "codigo_caducado";
    if (r.attempts >= MAX_ATTEMPTS) return "codigo_caducado";
    if (r.code_hash !== codeHash) {
      await sql`update email_verifications set attempts = attempts + 1 where email = ${norm}`;
      return "codigo_incorrecto";
    }
    await sql`delete from email_verifications where email = ${norm}`;
    return "ok";
  }
  const r = memCodes().get(norm);
  if (!r || r.expiresAt <= Date.now() || r.attempts >= MAX_ATTEMPTS) return "codigo_caducado";
  if (r.codeHash !== codeHash) {
    r.attempts++;
    return "codigo_incorrecto";
  }
  memCodes().delete(norm);
  return "ok";
}
