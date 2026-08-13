import { createHmac, timingSafeEqual } from "crypto";
import { serverConfig } from "../config";
import type { CalendarEvent } from "../providers/types";

/**
 * iCalendar (RFC 5545) feed so the agenda that ZERO manages can be subscribed
 * to from Apple Calendar, Google Calendar, Outlook… The URL carries a signed
 * token because calendar clients fetch it without any authentication headers.
 */

const PRODID = "-//ZERO//Asistente personal//ES";

/** Escape a text value: order matters — backslash first. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold lines at 75 octets (not characters — acentos ocupan 2 bytes). */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Never split a multi-byte character: back off to a lead byte.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    out.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
    limit = 74; // continuation lines start with a space
  }
  return out.join("\r\n ");
}

/** UTC stamp: 20260813T080500Z */
function utcStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

const MADRID_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Date-only value for all-day events: 20260814.
 *  OJO: se calcula en Europe/Madrid, no en UTC — las 00:00 de Madrid son las
 *  22:00 UTC del día anterior, y en UTC el evento saldría un día antes. */
function dateStamp(iso: string): string {
  return MADRID_DATE.format(new Date(iso)).replace(/-/g, "");
}

export interface IcsOptions {
  name: string;
  /** Minutes clients should wait before refetching. */
  refreshMinutes: number;
}

/** Builds the whole VCALENDAR document. Times are emitted in UTC, which every
 *  client converts back to the viewer's zone — no VTIMEZONE needed. */
export function buildIcs(events: CalendarEvent[], opts: IcsOptions): string {
  const stamp = utcStamp(new Date().toISOString());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.name)}`,
    "X-WR-TIMEZONE:Europe/Madrid",
    `X-PUBLISHED-TTL:PT${opts.refreshMinutes}M`,
    `REFRESH-INTERVAL;VALUE=DURATION:PT${opts.refreshMinutes}M`,
  ];

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    // Stable across refetches so clients update instead of duplicating.
    lines.push(`UID:${escapeText(`${ev.id}@zero`)}`);
    lines.push(`DTSTAMP:${stamp}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(ev.start)}`);
      lines.push(`DTEND;VALUE=DATE:${dateStamp(ev.end)}`);
    } else {
      lines.push(`DTSTART:${utcStamp(ev.start)}`);
      lines.push(`DTEND:${utcStamp(ev.end)}`);
    }
    lines.push(`SUMMARY:${escapeText(ev.title || "(sin título)")}`);
    if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  // RFC 5545 requires CRLF; the trailing one closes the last line.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// ---------------------------- feed token ----------------------------

function feedSecret(): string {
  return (
    process.env.CALENDAR_FEED_SECRET?.trim() ||
    serverConfig.tokenEncryptionKey.trim() ||
    ""
  );
}

/** True when a feed can be published (there is a secret to sign it with). */
export function isFeedConfigured(): boolean {
  return feedSecret().length > 0;
}

/**
 * Per-user token. Derived from a secret instead of stored, so it needs no
 * table and can be revoked for everyone by rotating CALENDAR_FEED_SECRET.
 */
export function feedToken(userId: string): string {
  return createHmac("sha256", feedSecret())
    .update(`zero-calendar-feed:${userId}`)
    .digest("base64url")
    .slice(0, 43);
}

/** Timing-safe check. Returns false when feeds are not configured. */
export function verifyFeedToken(userId: string, token: string): boolean {
  if (!isFeedConfigured() || !token) return false;
  const expected = Buffer.from(feedToken(userId));
  const given = Buffer.from(token);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}
