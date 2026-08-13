import { describe, it, expect } from "vitest";
import { buildIcs, escapeText, foldLine, feedToken, verifyFeedToken } from "./ics";
import type { CalendarEvent } from "../providers/types";

const OPTS = { name: "ZERO · Daniel", refreshMinutes: 15 };

function ev(over: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "ev-1",
    calendarId: "primary",
    title: "Gimnasio",
    start: "2026-08-14T13:00:00+02:00",
    end: "2026-08-14T14:00:00+02:00",
    ...over,
  };
}

describe("escapeText", () => {
  it("escapa según RFC 5545, con la barra invertida primero", () => {
    expect(escapeText("a;b,c")).toBe("a\\;b\\,c");
    expect(escapeText("C:\\ruta")).toBe("C:\\\\ruta");
    expect(escapeText("linea1\nlinea2")).toBe("linea1\\nlinea2");
    // Una barra ya escapada no debe duplicarse mal: \, → \\\,
    expect(escapeText("\\,")).toBe("\\\\\\,");
  });
});

describe("foldLine", () => {
  it("deja las líneas cortas intactas", () => {
    expect(foldLine("SUMMARY:Gimnasio")).toBe("SUMMARY:Gimnasio");
  });

  it("pliega a 75 octetos con espacio de continuación", () => {
    const out = foldLine("SUMMARY:" + "a".repeat(200));
    const parts = out.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    expect(Buffer.from(parts[0], "utf8").length).toBeLessThanOrEqual(75);
    for (const p of parts.slice(1)) expect(p.startsWith(" ")).toBe(true);
    // Sin pérdidas: al desplegar se recupera el original.
    expect(out.replace(/\r\n /g, "")).toBe("SUMMARY:" + "a".repeat(200));
  });

  it("nunca parte un carácter multibyte por la mitad", () => {
    const out = foldLine("SUMMARY:" + "á".repeat(80));
    expect(out.replace(/\r\n /g, "")).toBe("SUMMARY:" + "á".repeat(80));
    expect(out).not.toContain("\uFFFD");
  });
});

describe("buildIcs", () => {
  it("genera un VCALENDAR válido con CRLF y refresco", () => {
    const ics = buildIcs([ev()], OPTS);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("X-PUBLISHED-TTL:PT15M");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT15M");
    expect(ics.includes("\n") && !ics.includes("\r\n")).toBe(false);
  });

  it("convierte las horas de Madrid a UTC", () => {
    const ics = buildIcs([ev()], OPTS);
    // 13:00 en Madrid (CEST, +02:00) = 11:00 UTC
    expect(ics).toContain("DTSTART:20260814T110000Z");
    expect(ics).toContain("DTEND:20260814T120000Z");
  });

  it("usa VALUE=DATE en los eventos de todo el día", () => {
    const ics = buildIcs(
      [ev({ allDay: true, start: "2026-08-14T00:00:00+02:00", end: "2026-08-15T00:00:00+02:00" })],
      OPTS,
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20260814");
    expect(ics).not.toContain("DTSTART:2026");
  });

  it("da a cada evento un UID estable para que se actualice y no se duplique", () => {
    const a = buildIcs([ev()], OPTS);
    const b = buildIcs([ev({ title: "Gimnasio (movido)" })], OPTS);
    expect(a).toContain("UID:ev-1@zero");
    expect(b).toContain("UID:ev-1@zero");
  });

  it("escapa títulos y ubicaciones con comas o puntos y coma", () => {
    const ics = buildIcs([ev({ title: "Cena; con Marta, y Paco", location: "Calle A, 3" })], OPTS);
    expect(ics).toContain("SUMMARY:Cena\\; con Marta\\, y Paco");
    expect(ics).toContain("LOCATION:Calle A\\, 3");
  });

  it("no se rompe sin eventos ni sin título", () => {
    expect(buildIcs([], OPTS)).toContain("END:VCALENDAR");
    expect(buildIcs([ev({ title: "" })], OPTS)).toContain("SUMMARY:(sin título)");
  });
});

describe("token del feed", () => {
  // vitest.config define TOKEN_ENCRYPTION_KEY, que sirve de secreto.
  it("es estable por usuario y distinto entre usuarios", () => {
    expect(feedToken("u1")).toBe(feedToken("u1"));
    expect(feedToken("u1")).not.toBe(feedToken("u2"));
  });

  it("solo valida el token correcto", () => {
    const t = feedToken("u1");
    expect(verifyFeedToken("u1", t)).toBe(true);
    expect(verifyFeedToken("u2", t)).toBe(false);
    expect(verifyFeedToken("u1", "")).toBe(false);
    expect(verifyFeedToken("u1", t.slice(0, -1) + "x")).toBe(false);
    // Longitud distinta: no debe lanzar (timingSafeEqual exige igual tamaño).
    expect(verifyFeedToken("u1", "corto")).toBe(false);
  });
});
