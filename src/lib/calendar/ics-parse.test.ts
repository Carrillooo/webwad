import { describe, it, expect } from "vitest";
import { parseIcsEvents } from "./ics-parse";
import { normalizeIcsUrl } from "./external";

const WIN = ["2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z"] as const;

function wrap(vevents: string): string {
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${vevents}END:VCALENDAR\r\n`;
}

describe("parser de iCal", () => {
  it("evento con hora en UTC, con plegado de líneas y escapes", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nUID:e1\r\nDTSTART:20260814T100000Z\r\nDTEND:20260814T110000Z\r\n" +
        "SUMMARY:Reunión con\r\n  el equipo\\, sala 2\r\nLOCATION:Oficina\r\nEND:VEVENT\r\n",
    );
    const [ev] = parseIcsEvents(ics, "Trabajo", ...WIN);
    expect(ev.title).toBe("Reunión con el equipo, sala 2");
    expect(ev.start).toBe("2026-08-14T10:00:00.000Z");
    expect(ev.end).toBe("2026-08-14T11:00:00.000Z");
    expect(ev.location).toBe("Oficina");
    expect(ev.id.startsWith("ext:")).toBe(true);
    expect(ev.source).toBe("external");
  });

  it("evento con TZID de Madrid pasa a UTC correcto (verano = UTC+2)", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nUID:e2\r\nDTSTART;TZID=Europe/Madrid:20260814T100000\r\n" +
        "DTEND;TZID=Europe/Madrid:20260814T113000\r\nSUMMARY:Cita\r\nEND:VEVENT\r\n",
    );
    const [ev] = parseIcsEvents(ics, "c", ...WIN);
    expect(ev.start).toBe("2026-08-14T08:00:00.000Z");
    expect(ev.end).toBe("2026-08-14T09:30:00.000Z");
  });

  it("evento de día completo (VALUE=DATE) conserva la fecha", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nUID:e3\r\nDTSTART;VALUE=DATE:20260815\r\nDTEND;VALUE=DATE:20260816\r\n" +
        "SUMMARY:Festivo\r\nEND:VEVENT\r\n",
    );
    const [ev] = parseIcsEvents(ics, "Festivos", ...WIN);
    expect(ev.allDay).toBe(true);
    expect(ev.start).toBe("2026-08-15");
    expect(ev.end).toBe("2026-08-16");
  });

  it("RRULE semanal con BYDAY se expande solo dentro de la ventana", () => {
    // Clase lunes y miércoles desde julio; en agosto de 2026 deben salir ~9.
    const ics = wrap(
      "BEGIN:VEVENT\r\nUID:e4\r\nDTSTART:20260701T090000Z\r\nDTEND:20260701T100000Z\r\n" +
        "RRULE:FREQ=WEEKLY;BYDAY=MO,WE\r\nSUMMARY:Clase\r\nEND:VEVENT\r\n",
    );
    const evs = parseIcsEvents(ics, "Horario", ...WIN);
    expect(evs.length).toBeGreaterThanOrEqual(8);
    expect(evs.length).toBeLessThanOrEqual(10);
    for (const ev of evs) {
      const dow = new Date(ev.start).getUTCDay();
      expect([1, 3]).toContain(dow); // lunes o miércoles
      expect(new Date(ev.start).getTime()).toBeGreaterThanOrEqual(new Date(WIN[0]).getTime() - 86_400_000);
    }
  });

  it("RRULE diaria con COUNT respeta el tope", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nUID:e5\r\nDTSTART:20260810T070000Z\r\nDTEND:20260810T073000Z\r\n" +
        "RRULE:FREQ=DAILY;COUNT=3\r\nSUMMARY:Medicación\r\nEND:VEVENT\r\n",
    );
    expect(parseIcsEvents(ics, "c", ...WIN)).toHaveLength(3);
  });

  it("los eventos fuera de la ventana no aparecen", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nUID:e6\r\nDTSTART:20261001T100000Z\r\nDTEND:20261001T110000Z\r\nSUMMARY:Lejos\r\nEND:VEVENT\r\n",
    );
    expect(parseIcsEvents(ics, "c", ...WIN)).toHaveLength(0);
  });
});

describe("normalizeIcsUrl (guardas SSRF)", () => {
  it("acepta https y convierte webcal://", () => {
    const r = normalizeIcsUrl("webcal://p123.icloud.com/published/2/abc");
    expect(r).toMatchObject({ ok: true, url: "https://p123.icloud.com/published/2/abc" });
  });

  it("bloquea localhost, IPs privadas y esquemas raros", () => {
    for (const mala of [
      "http://localhost/x.ics",
      "http://127.0.0.1/x.ics",
      "https://192.168.1.10/x.ics",
      "https://10.0.0.5/x.ics",
      "https://172.16.0.1/x.ics",
      "https://169.254.1.1/x.ics",
      "file:///etc/passwd",
      "no-es-un-enlace",
    ]) {
      expect(normalizeIcsUrl(mala).ok, mala).toBe(false);
    }
  });
});
