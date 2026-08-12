/**
 * Lightweight Spanish date/time parser for the demo assistant (NLU).
 *
 * Resolves phrases like "mañana", "el viernes", "las cinco", "19:30",
 * "durante hora y media", "media hora" against Europe/Madrid. Not exhaustive,
 * but covers the command set in the ZERO spec. The Anthropic provider (Phase 7)
 * replaces this with the model's own reasoning + get_current_datetime tool.
 */
import { nowZoned, makeZonedInstant, toZonedIso, addDaysZoned } from "../datetime";

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  "miércoles": 3,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  "sábado": 6,
  sabado: 6,
};

const NUMBER_WORDS: Record<string, number> = {
  una: 1, uno: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciséis: 16, dieciseis: 16,
  diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
  veintiuna: 21, veintiuno: 21, veintidós: 22, veintidos: 22,
  veintitrés: 23, veintitres: 23, veinticuatro: 24,
  media: 30, cuarto: 15,
};

export interface ParsedDay {
  /** Zoned wall-clock Date at 00:00 of the resolved day. */
  date: Date;
  label: string;
}

function normalize(s: string): string {
  return s.toLowerCase();
}

/** Resolve the referenced day. Defaults to today when nothing matches. */
export function parseDay(text: string, base: Date = new Date()): ParsedDay {
  const t = normalize(text);
  const today = nowZoned(base);

  if (/\bpasado\s+mañana\b/.test(t)) {
    return { date: nowZoned(addDaysZoned(base, 2)), label: "pasado mañana" };
  }
  if (/\bmañana\b/.test(t)) {
    return { date: nowZoned(addDaysZoned(base, 1)), label: "mañana" };
  }
  if (/\bhoy\b/.test(t)) {
    return { date: today, label: "hoy" };
  }
  if (/\bayer\b/.test(t)) {
    return { date: nowZoned(addDaysZoned(base, -1)), label: "ayer" };
  }

  // "el viernes", "este viernes", "el próximo lunes"
  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    const re = new RegExp(`\\b${name}\\b`);
    if (re.test(t)) {
      const cur = today.getDay();
      let delta = (dow - cur + 7) % 7;
      // Referring to a weekday name usually means the upcoming one; if it's
      // today, assume next week unless "hoy" was present.
      if (delta === 0) delta = 7;
      if (/\bpróximo|proximo|que viene\b/.test(t)) delta += delta <= 0 ? 7 : 0;
      return { date: nowZoned(addDaysZoned(base, delta)), label: name };
    }
  }

  return { date: today, label: "hoy" };
}

/** Extract a time-of-day in minutes-since-midnight, or null. */
export function parseTime(text: string): number | null {
  const t = normalize(text);

  // 24h / colon forms: 19:30, 19.30, 19h, 9h
  const m1 = t.match(/\b(\d{1,2})[:.h](\d{2})\b/);
  if (m1) return clampTime(Number(m1[1]) * 60 + Number(m1[2]));
  const m2 = t.match(/\b(\d{1,2})\s*h\b/);
  if (m2) return clampTime(Number(m2[1]) * 60);

  // "a las cinco (y media / y cuarto)", "a las 8"
  const m3 = t.match(/\ba\s+las?\s+([a-záéíóú]+|\d{1,2})(?:\s+y\s+(media|cuarto|[a-záéíóú]+|\d{1,2}))?/);
  if (m3) {
    let h = wordOrNumber(m3[1]);
    if (h === null) return null;
    let min = 0;
    if (m3[2]) {
      const frac = wordOrNumber(m3[2]);
      if (frac !== null) min = frac;
    }
    // Heuristic: "a las cinco" spoken usually means afternoon for small hours
    // in an assistant context, but keep it literal unless "de la tarde/noche".
    if (/\bde\s+la\s+tarde\b|\bde\s+la\s+noche\b/.test(t) && h < 12) h += 12;
    return clampTime(h * 60 + min);
  }

  // bare 24h number "a las 20"
  const m4 = t.match(/\blas?\s+(\d{1,2})\b/);
  if (m4) return clampTime(Number(m4[1]) * 60);

  return null;
}

/** Extract a duration in minutes, or null. */
export function parseDuration(text: string): number | null {
  const t = normalize(text);

  // "90 min", "45 minutos"
  const min = t.match(/\b(\d{1,3})\s*(min|minutos?)\b/);
  if (min) return Number(min[1]);

  // "hora y media" / "una hora y media"
  if (/\bhora\s+y\s+media\b/.test(t)) return 90;
  if (/\bmedia\s+hora\b/.test(t)) return 30;

  // "dos horas", "1 hora", "2h"
  const h = t.match(/\b(\d{1,2}|[a-záéíóú]+)\s*(horas?|h)\b/);
  if (h) {
    const n = wordOrNumber(h[1]);
    if (n !== null) {
      const half = /\by\s+media\b/.test(t) ? 30 : 0;
      return n * 60 + half;
    }
  }
  return null;
}

function wordOrNumber(s: string): number | null {
  if (/^\d+$/.test(s)) return Number(s);
  return NUMBER_WORDS[s] ?? null;
}

function clampTime(mins: number): number {
  return Math.max(0, Math.min(24 * 60 - 1, mins));
}

/** Build an ISO instant from a ParsedDay + minutes-of-day. */
export function toIso(day: ParsedDay, minutesOfDay: number): string {
  const y = day.date.getFullYear();
  const m = day.date.getMonth() + 1;
  const d = day.date.getDate();
  const h = Math.floor(minutesOfDay / 60);
  const min = minutesOfDay % 60;
  return toZonedIso(makeZonedInstant(y, m, d, h, min));
}
