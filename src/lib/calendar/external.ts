import { randomUUID } from "node:crypto";
import { database, isDatabaseConfigured } from "../db/server";
import { parseIcsEvents } from "./ics-parse";
import type { CalendarEvent } from "../providers/types";

/**
 * Calendarios ENLAZADOS por URL iCal: iCloud público, otro Google compartido,
 * festivos, Calendly, horarios de clase… Solo lectura: sus eventos se mezclan
 * en el calendario de ZERO pero nunca se editan.
 */

export interface ExternalCalendar {
  id: string;
  userId: string;
  name: string;
  url: string;
  createdAt: string;
}

const MAX_PER_USER = 10;
const MAX_ICS_BYTES = 2 * 1024 * 1024; // 2 MB: un calendario no pesa más
const FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 10 * 60_000;

// ------------------------------- almacenamiento ------------------------------

const g = globalThis as unknown as {
  __zeroExtCals?: Map<string, ExternalCalendar>;
  __zeroExtCache?: Map<string, { at: number; ics: string }>;
};
function mem() {
  if (!g.__zeroExtCals) g.__zeroExtCals = new Map();
  return g.__zeroExtCals;
}
function cache() {
  if (!g.__zeroExtCache) g.__zeroExtCache = new Map();
  return g.__zeroExtCache;
}

export async function listExternalCalendars(userId: string): Promise<ExternalCalendar[]> {
  if (isDatabaseConfigured()) {
    const sql = await database();
    const rows = await sql`select * from external_calendars where user_id = ${userId} order by created_at asc`;
    return (rows as unknown as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      name: String(r.name),
      url: String(r.url),
      createdAt: new Date(r.created_at as string | Date).toISOString(),
    }));
  }
  return [...mem().values()].filter((c) => c.userId === userId);
}

export async function addExternalCalendar(
  userId: string,
  name: string,
  url: string,
): Promise<{ ok: true; calendar: ExternalCalendar } | { ok: false; error: string }> {
  const existing = await listExternalCalendars(userId);
  if (existing.length >= MAX_PER_USER) {
    return { ok: false, error: `Máximo ${MAX_PER_USER} calendarios enlazados.` };
  }
  if (existing.some((c) => c.url === url)) {
    return { ok: false, error: "Ese calendario ya está enlazado." };
  }
  const cal: ExternalCalendar = {
    id: randomUUID(),
    userId,
    name: name.trim().slice(0, 60) || "Calendario",
    url,
    createdAt: new Date().toISOString(),
  };
  if (isDatabaseConfigured()) {
    const sql = await database();
    await sql`insert into external_calendars (id, user_id, name, url) values (${cal.id}, ${userId}, ${cal.name}, ${cal.url})`;
  } else {
    mem().set(cal.id, cal);
  }
  return { ok: true, calendar: cal };
}

export async function removeExternalCalendar(userId: string, id: string): Promise<boolean> {
  if (isDatabaseConfigured()) {
    const sql = await database();
    const rows = await sql`delete from external_calendars where id = ${id} and user_id = ${userId} returning id`;
    return rows.length > 0;
  }
  const c = mem().get(id);
  if (!c || c.userId !== userId) return false;
  mem().delete(id);
  return true;
}

// --------------------------------- descarga ---------------------------------

/**
 * Normaliza y valida la URL. El servidor va a hacer un fetch a donde diga el
 * usuario, así que se bloquea todo lo interno (SSRF): localhost, IPs privadas
 * y esquemas raros. webcal:// (Apple) se convierte a https://.
 */
export function normalizeIcsUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let u: URL;
  try {
    u = new URL(raw.trim().replace(/^webcal:\/\//i, "https://"));
  } catch {
    return { ok: false, error: "Eso no parece un enlace válido." };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { ok: false, error: "El enlace tiene que ser http(s) o webcal." };
  }
  const host = u.hostname.toLowerCase();
  const privado =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host === "::1" ||
    /^\[?f[cd][0-9a-f]{2}:/i.test(host) ||
    /^\[?fe80:/i.test(host);
  if (privado) return { ok: false, error: "Ese enlace apunta a una red privada; no está permitido." };
  return { ok: true, url: u.toString() };
}

/** Descarga el ICS (con caché de 10 min) y lo valida a grandes rasgos. */
export async function fetchIcs(url: string): Promise<{ ok: true; ics: string } | { ok: false; error: string }> {
  const hit = cache().get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { ok: true, ics: hit.ics };
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { Accept: "text/calendar, text/plain, */*" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: `El servidor del calendario respondió ${res.status}.` };
    const text = await res.text();
    if (text.length > MAX_ICS_BYTES) return { ok: false, error: "Ese calendario es demasiado grande (más de 2 MB)." };
    if (!/BEGIN:VCALENDAR/i.test(text.slice(0, 2000))) {
      return { ok: false, error: "El enlace no devuelve un calendario iCal (.ics)." };
    }
    cache().set(url, { at: Date.now(), ics: text });
    return { ok: true, ics: text };
  } catch (e) {
    return { ok: false, error: `No se pudo descargar el calendario: ${(e as Error).message}` };
  }
}

/** Eventos de TODOS los calendarios enlazados del usuario dentro del rango.
 *  Nunca lanza: un calendario caído no tumba la agenda. */
export async function listExternalEvents(
  userId: string,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<CalendarEvent[]> {
  const cals = await listExternalCalendars(userId);
  if (!cals.length) return [];
  const results = await Promise.all(
    cals.map(async (cal) => {
      const got = await fetchIcs(cal.url);
      if (!got.ok) {
        console.error(`calendario externo "${cal.name}" falló: ${got.error}`);
        return [] as CalendarEvent[];
      }
      try {
        return parseIcsEvents(got.ics, cal.name, rangeStartIso, rangeEndIso);
      } catch (e) {
        console.error(`calendario externo "${cal.name}" no se pudo interpretar`, e);
        return [] as CalendarEvent[];
      }
    }),
  );
  return results.flat();
}
