import { describe, it, expect } from "vitest";
import { parseDay, parseTime, parseDuration, toIso } from "./spanish-datetime";
import { toZonedTime } from "date-fns-tz";

// Fixed base: Wed 12 Aug 2026, 10:00 Madrid (summer, UTC+2).
const BASE = new Date("2026-08-12T08:00:00Z");

describe("parseDay", () => {
  it("resolves 'hoy'", () => {
    expect(parseDay("¿qué tengo hoy?", BASE).label).toBe("hoy");
  });
  it("resolves 'mañana' to the next day", () => {
    const d = parseDay("añádeme algo mañana", BASE);
    expect(d.label).toBe("mañana");
    expect(d.date.getDate()).toBe(13);
  });
  it("resolves 'pasado mañana'", () => {
    expect(parseDay("pasado mañana", BASE).date.getDate()).toBe(14);
  });
  it("resolves 'el viernes' to the upcoming Friday", () => {
    // 12 Aug 2026 is Wednesday; Friday is the 14th.
    expect(parseDay("ponme reunión el viernes", BASE).date.getDate()).toBe(14);
  });
  it("weekday name for today assumes next week", () => {
    // Wednesday → "miércoles" means next week's, +7.
    expect(parseDay("el miércoles", BASE).date.getDate()).toBe(19);
  });
});

describe("parseTime", () => {
  it("parses 24h 19:30", () => expect(parseTime("a las 19:30")).toBe(19 * 60 + 30));
  it("parses 19h", () => expect(parseTime("a las 19h")).toBe(19 * 60));
  it("parses 'a las cinco'", () => expect(parseTime("ponme algo a las cinco")).toBe(5 * 60));
  it("parses 'a las cinco de la tarde'", () =>
    expect(parseTime("a las cinco de la tarde")).toBe(17 * 60));
  it("parses 'a las ocho y media'", () => expect(parseTime("a las ocho y media")).toBe(8 * 60 + 30));
  it("parses '2 de la tarde' → 14:00", () => expect(parseTime("calendario mañana 2 de la tarde")).toBe(14 * 60));
  it("parses '10 de la noche' → 22:00", () => expect(parseTime("cena 10 de la noche")).toBe(22 * 60));
  it("parses '8 de la mañana' → 08:00", () => expect(parseTime("gym 8 de la mañana")).toBe(8 * 60));
  it("parses 'sobre las 5' → 17? no, literal 5", () => expect(parseTime("sobre las 5")).toBe(5 * 60));
  it("parses '2 y media de la tarde' → 14:30", () => expect(parseTime("2 y media de la tarde")).toBe(14 * 60 + 30));
  it("parses 'mediodía' and 'medianoche'", () => {
    expect(parseTime("quedamos a mediodía")).toBe(12 * 60);
    expect(parseTime("a medianoche")).toBe(0);
  });
  it("parses 'las tres menos cuarto' → 14:45", () => expect(parseTime("las tres menos cuarto de la tarde")).toBe(14 * 60 + 45));
  it("returns null when no time", () => expect(parseTime("qué tengo mañana")).toBeNull());
});

describe("parseDuration", () => {
  it("parses '90 min'", () => expect(parseDuration("durante 90 min")).toBe(90));
  it("parses 'hora y media'", () => expect(parseDuration("durante hora y media")).toBe(90));
  it("parses 'media hora'", () => expect(parseDuration("media hora")).toBe(30));
  it("parses 'dos horas'", () => expect(parseDuration("trabajar dos horas")).toBe(120));
  it("parses '1 hora'", () => expect(parseDuration("1 hora")).toBe(60));
});

describe("toIso (Europe/Madrid)", () => {
  it("emits +02:00 offset in summer (DST)", () => {
    const day = parseDay("mañana", BASE);
    const iso = toIso(day, 19 * 60 + 30);
    expect(iso).toContain("+02:00");
    expect(iso).toContain("19:30:00");
  });
  it("emits +01:00 offset in winter (standard time)", () => {
    const winter = new Date("2026-01-15T09:00:00Z");
    const day = parseDay("hoy", winter);
    const iso = toIso(day, 10 * 60);
    expect(iso).toContain("+01:00");
  });
  it("round-trips to the correct wall-clock hour", () => {
    const day = parseDay("mañana", BASE);
    const iso = toIso(day, 19 * 60 + 30);
    const z = toZonedTime(new Date(iso), "Europe/Madrid");
    expect(z.getHours()).toBe(19);
    expect(z.getMinutes()).toBe(30);
  });
});
