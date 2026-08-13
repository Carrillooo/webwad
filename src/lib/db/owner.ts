import { database, isDatabaseConfigured } from "./server";

const DEFAULT_OWNER_ID = "00000000-0000-4000-8000-000000000001";
const g = globalThis as unknown as { __zeroOwnerId?: string | null };

/** Stable single-owner identity for ZERO's personal Vercel database. */
export async function ensureOwnerUser(): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  if (g.__zeroOwnerId !== undefined) return g.__zeroOwnerId;

  const id = process.env.ZERO_OWNER_ID?.trim() || DEFAULT_OWNER_ID;
  const displayName = process.env.ZERO_OWNER_NAME?.trim() || "Daniel";
  const locale = process.env.ZERO_LOCALE?.trim() || "es-ES";
  const timezone = process.env.ZERO_TIMEZONE?.trim() || "Europe/Madrid";

  try {
    const sql = await database();
    await sql`
      insert into profiles (id, display_name, locale, timezone, updated_at)
      values (${id}, ${displayName}, ${locale}, ${timezone}, now())
      on conflict (id) do update set
        display_name = excluded.display_name,
        locale = excluded.locale,
        timezone = excluded.timezone,
        updated_at = now()
    `;
    g.__zeroOwnerId = id;
    return id;
  } catch {
    g.__zeroOwnerId = null;
    return null;
  }
}
