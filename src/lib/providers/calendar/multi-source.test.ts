import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { GoogleCalendarProvider } from "./google";
import { MicrosoftCalendarProvider } from "./microsoft";

/**
 * Lo que rompía antes: ZERO solo miraba el calendario "primary". Un calendario
 * compartido o suscrito (el del trabajo, el del colegio) no aparecía.
 */

const g = globalThis as unknown as { __zeroCalIds?: Map<string, unknown> };
const RANGO = ["2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z"] as const;

beforeEach(() => {
  g.__zeroCalIds = undefined;
});
afterEach(() => vi.unstubAllGlobals());

describe("Google: todos los calendarios", () => {
  it("consulta cada calendario de la cuenta, no solo el principal", async () => {
    const pedidos: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/users/me/calendarList")) {
          return new Response(
            JSON.stringify({
              items: [
                { id: "primary", primary: true },
                { id: "manegbac@group.calendar.google.com", selected: true },
                { id: "borrado", deleted: true },
              ],
            }),
            { status: 200 },
          );
        }
        const m = u.match(/\/calendars\/([^/]+)\/events/);
        if (m) {
          const cal = decodeURIComponent(m[1]);
          pedidos.push(cal);
          return new Response(
            JSON.stringify({
              items: [
                {
                  id: `ev-${cal}`,
                  summary: `Evento de ${cal}`,
                  start: { dateTime: "2026-09-01T09:00:00Z" },
                  end: { dateTime: "2026-09-01T10:00:00Z" },
                },
              ],
            }),
            { status: 200 },
          );
        }
        throw new Error(`llamada inesperada: ${u}`);
      }),
    );

    const eventos = await new GoogleCalendarProvider("tok").listEvents(...RANGO);
    expect(pedidos.sort()).toEqual(["manegbac@group.calendar.google.com", "primary"]);
    expect(eventos).toHaveLength(2);
    // El calendario borrado se queda fuera.
    expect(pedidos).not.toContain("borrado");
  });

  it("la ocupación pregunta por todos los calendarios de golpe", async () => {
    let cuerpo: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/users/me/calendarList")) {
          return new Response(
            JSON.stringify({ items: [{ id: "primary", primary: true }, { id: "trabajo" }] }),
            { status: 200 },
          );
        }
        cuerpo = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            calendars: {
              primary: { busy: [{ start: "2026-09-01T09:00:00Z", end: "2026-09-01T10:00:00Z" }] },
              trabajo: { busy: [{ start: "2026-09-01T12:00:00Z", end: "2026-09-01T13:00:00Z" }] },
            },
          }),
          { status: 200 },
        );
      }),
    );

    const ocupado = await new GoogleCalendarProvider("tok").freeBusy(...RANGO);
    expect(cuerpo.items).toEqual([{ id: "primary" }, { id: "trabajo" }]);
    expect(ocupado).toHaveLength(2); // suma la ocupación de los dos
  });

  it("si un calendario falla, los demás siguen apareciendo", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/users/me/calendarList")) {
          return new Response(JSON.stringify({ items: [{ id: "primary", primary: true }, { id: "roto" }] }), {
            status: 200,
          });
        }
        if (u.includes("/calendars/roto/")) return new Response("nope", { status: 403 });
        return new Response(
          JSON.stringify({
            items: [{ id: "e1", summary: "Vale", start: { dateTime: "2026-09-01T09:00:00Z" }, end: { dateTime: "2026-09-01T10:00:00Z" } }],
          }),
          { status: 200 },
        );
      }),
    );
    const eventos = await new GoogleCalendarProvider("tok").listEvents(...RANGO);
    expect(eventos).toHaveLength(1);
  });
});

describe("Outlook: todos los calendarios", () => {
  it("recorre cada calendario de la cuenta", async () => {
    const pedidos: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/me/calendars?")) {
          return new Response(
            JSON.stringify({
              value: [
                { id: "def", isDefaultCalendar: true },
                { id: "equipo" },
              ],
            }),
            { status: 200 },
          );
        }
        const m = u.match(/\/me\/calendars\/([^/]+)\/calendarView/);
        if (m) {
          pedidos.push(decodeURIComponent(m[1]));
          return new Response(
            JSON.stringify({
              value: [
                {
                  id: `ev-${m[1]}`,
                  subject: "Reunión",
                  start: { dateTime: "2026-09-01T09:00:00.0000000" },
                  end: { dateTime: "2026-09-01T10:00:00.0000000" },
                },
              ],
            }),
            { status: 200 },
          );
        }
        throw new Error(`llamada inesperada: ${u}`);
      }),
    );

    const eventos = await new MicrosoftCalendarProvider("tok").listEvents(...RANGO);
    expect(pedidos.sort()).toEqual(["def", "equipo"]);
    expect(eventos).toHaveLength(2);
  });
});
