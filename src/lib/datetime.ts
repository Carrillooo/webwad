/**
 * Timezone-aware date helpers, fixed to Europe/Madrid + es-ES + 24h + Monday.
 *
 * All calendar reasoning goes through here so DST and "mañana / viernes"
 * resolution stay consistent. We build/parse using the IANA zone via
 * date-fns-tz rather than the runtime's local zone.
 */
import { addDays, startOfWeek, endOfWeek, startOfDay, endOfDay, format } from "date-fns";
import { es } from "date-fns/locale";
import { fromZonedTime, toZonedTime, format as formatTz } from "date-fns-tz";
import { DEFAULT_TIMEZONE, WEEK_STARTS_ON } from "./constants";

export const TZ = DEFAULT_TIMEZONE;

/** "now" as a wall-clock Date in the app timezone. */
export function nowZoned(base: Date = new Date()): Date {
  return toZonedTime(base, TZ);
}

/** Convert a wall-clock (zoned) Date back to a real UTC instant. */
export function zonedToUtc(zoned: Date): Date {
  return fromZonedTime(zoned, TZ);
}

/** ISO string in the app timezone with offset, e.g. 2026-08-12T19:30:00+02:00 */
export function toZonedIso(instant: Date): string {
  return formatTz(toZonedTime(instant, TZ), "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: TZ });
}

/** Human day label, e.g. "miércoles · 12 agosto". */
export function humanDay(instant: Date | string): string {
  const z = toZonedTime(typeof instant === "string" ? new Date(instant) : instant, TZ);
  return format(z, "EEEE · d LLLL", { locale: es });
}

/** 24h time label, e.g. "19:30". */
export function humanTime(instant: Date | string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return formatTz(toZonedTime(d, TZ), "HH:mm", { timeZone: TZ });
}

/** Spanish greeting based on the current hour. */
export function greeting(instant: Date = new Date()): string {
  const h = Number(formatTz(toZonedTime(instant, TZ), "H", { timeZone: TZ }));
  if (h < 6) return "Buenas noches";
  if (h < 14) return "Buenos días";
  if (h < 21) return "Buenas tardes";
  return "Buenas noches";
}

/** Build a UTC instant from zoned wall-clock parts (y/m/d 1-based month). */
export function makeZonedInstant(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  const wall = new Date(year, month - 1, day, hour, minute, 0, 0);
  return fromZonedTime(wall, TZ);
}

export function dayBounds(instant: Date): { start: Date; end: Date } {
  const z = toZonedTime(instant, TZ);
  return {
    start: fromZonedTime(startOfDay(z), TZ),
    end: fromZonedTime(endOfDay(z), TZ),
  };
}

export function weekBounds(instant: Date): { start: Date; end: Date } {
  const z = toZonedTime(instant, TZ);
  return {
    start: fromZonedTime(startOfWeek(z, { weekStartsOn: WEEK_STARTS_ON }), TZ),
    end: fromZonedTime(endOfWeek(z, { weekStartsOn: WEEK_STARTS_ON }), TZ),
  };
}

export function addDaysZoned(instant: Date, days: number): Date {
  return fromZonedTime(addDays(toZonedTime(instant, TZ), days), TZ);
}

/** Minutes since midnight in the app timezone. */
export function minutesOfDay(instant: Date): number {
  const z = toZonedTime(instant, TZ);
  return z.getHours() * 60 + z.getMinutes();
}
