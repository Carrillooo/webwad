import { createHash } from "node:crypto";
import type { CalendarEvent } from "../types";

/**
 * Cachés cortas del calendario. Consultar la agenda dispara varias llamadas
 * (un calendario de Google, otro de Outlook, los enlazados…) y la interfaz
 * pregunta a menudo; sin esto, cada vistazo son segundos de espera.
 *
 * Todo dura segundos y se tira entero en cuanto ZERO escribe algo, así que
 * nunca se enseña una agenda vieja después de crear o mover un evento.
 */

const CALENDAR_IDS_TTL_MS = 5 * 60_000;
const EVENTS_TTL_MS = 20_000;

/** El token no se usa como clave en claro: solo su huella. */
function fingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

const g = globalThis as unknown as {
  __zeroCalIds?: Map<string, { at: number; ids: string[] }>;
  __zeroCalEvents?: Map<string, { at: number; events: CalendarEvent[] }>;
};
function idsCache() {
  if (!g.__zeroCalIds) g.__zeroCalIds = new Map();
  return g.__zeroCalIds;
}
function eventsCache() {
  if (!g.__zeroCalEvents) g.__zeroCalEvents = new Map();
  return g.__zeroCalEvents;
}

export function getCachedCalendarIds(token: string): string[] | null {
  const hit = idsCache().get(fingerprint(token));
  return hit && Date.now() - hit.at < CALENDAR_IDS_TTL_MS ? hit.ids : null;
}

export function setCachedCalendarIds(token: string, ids: string[]): void {
  idsCache().set(fingerprint(token), { at: Date.now(), ids });
}

function eventsKey(userId: string, startIso: string, endIso: string): string {
  return `${userId}|${startIso}|${endIso}`;
}

export function getCachedEvents(userId: string, startIso: string, endIso: string): CalendarEvent[] | null {
  const hit = eventsCache().get(eventsKey(userId, startIso, endIso));
  return hit && Date.now() - hit.at < EVENTS_TTL_MS ? hit.events : null;
}

export function setCachedEvents(
  userId: string,
  startIso: string,
  endIso: string,
  events: CalendarEvent[],
): void {
  const cache = eventsCache();
  // Tope de seguridad: esto vive en memoria del servidor, no puede crecer sin fin.
  if (cache.size > 500) cache.clear();
  cache.set(eventsKey(userId, startIso, endIso), { at: Date.now(), events });
}

/** Tras crear/mover/borrar algo, la agenda de ese usuario deja de valer. */
export function invalidateEvents(userId: string): void {
  for (const key of eventsCache().keys()) {
    if (key.startsWith(`${userId}|`)) eventsCache().delete(key);
  }
}
