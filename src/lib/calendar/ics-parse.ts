import type { CalendarEvent } from "../providers/types";

/**
 * Parser de iCalendar (RFC 5545) para calendarios ENLAZADOS (solo lectura):
 * iCloud, Google compartidos, festivos, Calendly, horarios…
 *
 * Cubre lo que traen los calendarios reales: plegado de líneas, escapes,
 * DTSTART/DTEND en UTC, con TZID o VALUE=DATE, y recurrencias RRULE básicas
 * (DAILY/WEEKLY/MONTHLY/YEARLY con INTERVAL/COUNT/UNTIL/BYDAY semanal),
 * expandidas SOLO dentro de la ventana pedida y con tope de iteraciones.
 */

const MAX_EXPANSION = 500; // tope duro por evento recurrente

function unfold(ics: string): string[] {
  const raw = ics.split(/\r?\n/);
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else if (line.length) {
      out.push(line);
    }
  }
  return out;
}

function unescapeText(s: string): string {
  return s
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

interface Prop {
  params: Record<string, string>;
  value: string;
}

function parseProp(line: string): { name: string; prop: Prop } | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), prop: { params, value } };
}

/** Offset (ms) de una zona IANA en un instante dado, vía Intl (sin librerías). */
function tzOffsetMs(tz: string, atUtcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(new Date(atUtcMs))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
  return asUtc - atUtcMs;
}

/** "20260814T100000" en una zona → epoch ms UTC. */
function zonedToUtcMs(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  // Dos pasadas bastan para clavar el offset incluso junto a un cambio de hora.
  const off1 = tzOffsetMs(tz, guess);
  const off2 = tzOffsetMs(tz, guess - off1);
  return guess - off2;
}

interface ParsedDate {
  ms: number;
  allDay: boolean;
  /** Para todo-día: la fecha tal cual (YYYY-MM-DD). */
  date?: string;
}

function parseIcsDate(prop: Prop): ParsedDate | null {
  const v = prop.value.trim();
  if (prop.params.VALUE === "DATE" || /^\d{8}$/.test(v)) {
    const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    return {
      ms: Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
      allDay: true,
      date: `${m[1]}-${m[2]}-${m[3]}`,
    };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])];
  if (m[7] === "Z") return { ms: Date.UTC(y, mo - 1, d, h, mi, s), allDay: false };
  const tz = prop.params.TZID;
  if (tz) {
    try {
      return { ms: zonedToUtcMs(y, mo, d, h, mi, s, tz), allDay: false };
    } catch {
      /* TZID desconocido → tratar como hora local UTC (mejor que descartar) */
    }
  }
  return { ms: Date.UTC(y, mo - 1, d, h, mi, s), allDay: false };
}

interface Rrule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count?: number;
  untilMs?: number;
  /** Días BYDAY para WEEKLY: 0=domingo…6=sábado. */
  byday?: number[];
}

const DAY_NUM: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseRrule(value: string): Rrule | null {
  const parts: Record<string, string> = {};
  for (const kv of value.split(";")) {
    const eq = kv.indexOf("=");
    if (eq > 0) parts[kv.slice(0, eq).toUpperCase()] = kv.slice(eq + 1);
  }
  const freq = parts.FREQ as Rrule["freq"];
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;
  const rule: Rrule = { freq, interval: Math.max(1, Number(parts.INTERVAL ?? 1) || 1) };
  if (parts.COUNT) rule.count = Number(parts.COUNT) || undefined;
  if (parts.UNTIL) {
    const until = parseIcsDate({ params: {}, value: parts.UNTIL });
    if (until) rule.untilMs = until.ms + (until.allDay ? 86_400_000 : 0);
  }
  if (freq === "WEEKLY" && parts.BYDAY) {
    const days = parts.BYDAY.split(",")
      .map((d) => DAY_NUM[d.trim().slice(-2)])
      .filter((n) => n !== undefined);
    if (days.length) rule.byday = days;
  }
  return rule;
}

interface RawEvent {
  props: Map<string, Prop>;
}

function toDateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Expande las apariciones de un evento (con o sin RRULE) dentro de la ventana. */
function occurrences(start: ParsedDate, rule: Rrule | null, winStartMs: number, winEndMs: number): number[] {
  if (!rule) return start.ms < winEndMs ? [start.ms] : [];
  const out: number[] = [];
  const stepDays = rule.freq === "DAILY" ? rule.interval : rule.freq === "WEEKLY" ? 7 * rule.interval : 0;
  let cursor = start.ms;
  let produced = 0;
  for (let i = 0; i < MAX_EXPANSION; i++) {
    if (rule.untilMs !== undefined && cursor >= rule.untilMs) break;
    if (rule.count !== undefined && produced >= rule.count) break;
    if (cursor >= winEndMs) break;

    if (rule.freq === "WEEKLY" && rule.byday) {
      // Semana a semana: emitir cada día BYDAY de la semana del cursor.
      const base = new Date(cursor);
      for (let d = 0; d < 7; d++) {
        const ms = cursor + d * 86_400_000;
        const dow = new Date(ms).getUTCDay();
        if (!rule.byday.includes(dow)) continue;
        if (ms < start.ms) continue;
        if (rule.untilMs !== undefined && ms >= rule.untilMs) break;
        if (rule.count !== undefined && produced >= rule.count) break;
        produced++;
        if (ms >= winStartMs - 86_400_000 && ms < winEndMs) out.push(ms);
      }
      void base;
      cursor += 7 * rule.interval * 86_400_000;
      continue;
    }

    produced++;
    if (cursor >= winStartMs - 86_400_000) out.push(cursor);

    if (stepDays) {
      cursor += stepDays * 86_400_000;
    } else {
      const d = new Date(cursor);
      if (rule.freq === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + rule.interval);
      else d.setUTCFullYear(d.getUTCFullYear() + rule.interval);
      cursor = d.getTime();
    }
  }
  return out;
}

/**
 * Convierte un ICS en eventos dentro de [rangeStartIso, rangeEndIso).
 * calendarId etiqueta el origen; los ids llevan el prefijo "ext:" para que
 * nadie intente editarlos (los calendarios enlazados son solo lectura).
 */
export function parseIcsEvents(
  ics: string,
  calendarId: string,
  rangeStartIso: string,
  rangeEndIso: string,
): CalendarEvent[] {
  const winStart = new Date(rangeStartIso).getTime();
  const winEnd = new Date(rangeEndIso).getTime();
  const lines = unfold(ics);

  const events: RawEvent[] = [];
  let current: RawEvent | null = null;
  for (const line of lines) {
    if (/^BEGIN:VEVENT$/i.test(line)) {
      current = { props: new Map() };
      continue;
    }
    if (/^END:VEVENT$/i.test(line)) {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const parsed = parseProp(line);
    // La primera aparición de cada propiedad manda (RFC): no pisar.
    if (parsed && !current.props.has(parsed.name)) current.props.set(parsed.name, parsed.prop);
  }

  const out: CalendarEvent[] = [];
  for (const ev of events) {
    const dtstart = ev.props.get("DTSTART");
    if (!dtstart) continue;
    const start = parseIcsDate(dtstart);
    if (!start) continue;

    const dtend = ev.props.get("DTEND");
    const end = dtend ? parseIcsDate(dtend) : null;
    const durMs = end ? Math.max(0, end.ms - start.ms) : start.allDay ? 86_400_000 : 3_600_000;

    const rrProp = ev.props.get("RRULE");
    const rule = rrProp ? parseRrule(rrProp.value) : null;
    const uid = ev.props.get("UID")?.value ?? `${start.ms}-${ev.props.get("SUMMARY")?.value ?? ""}`;

    for (const occMs of occurrences(start, rule, winStart, winEnd)) {
      const occEndMs = occMs + durMs;
      if (occEndMs <= winStart || occMs >= winEnd) continue;
      out.push({
        id: `ext:${calendarId}:${uid}:${occMs}`,
        calendarId,
        title: unescapeText(ev.props.get("SUMMARY")?.value ?? "(sin título)").slice(0, 200),
        start: start.allDay ? toDateStr(occMs) : new Date(occMs).toISOString(),
        end: start.allDay ? toDateStr(occEndMs) : new Date(occEndMs).toISOString(),
        allDay: start.allDay,
        location: ev.props.get("LOCATION") ? unescapeText(ev.props.get("LOCATION")!.value).slice(0, 200) : undefined,
        description: ev.props.get("DESCRIPTION")
          ? unescapeText(ev.props.get("DESCRIPTION")!.value).slice(0, 500)
          : undefined,
        source: "external",
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
