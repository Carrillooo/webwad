import { describe, it, expect, beforeEach, vi } from "vitest";
import { MergedCalendarProvider } from "./merged";
import { invalidateEvents } from "./cache";
import type { CalendarProvider, CalendarEvent, CreateEventInput } from "../types";

/** La agenda única: Google + Outlook + enlazados, sin duplicados. */

const g = globalThis as unknown as {
  __zeroCalEvents?: Map<string, unknown>;
  __zeroExtCals?: Map<string, unknown>;
};

function ev(title: string, start: string, source: CalendarEvent["source"], id = title): CalendarEvent {
  return { id, calendarId: "c", title, start, end: start, source };
}

/** Proveedor de mentira que registra lo que le piden. */
function fake(events: CalendarEvent[], kind: CalendarProvider["kind"] = "google") {
  const calls = { list: 0, create: 0, update: 0, del: 0 };
  const p: CalendarProvider = {
    kind,
    calls,
    listCalendars: async () => [],
    listEvents: async () => {
      calls.list++;
      return events;
    },
    getEvent: async () => null,
    createEvent: async (i: CreateEventInput) => {
      calls.create++;
      return ev(i.title, i.start, "google");
    },
    updateEvent: async (id: string) => {
      calls.update++;
      return ev("x", "2026-09-01T10:00:00Z", "google", id);
    },
    deleteEvent: async () => {
      calls.del++;
    },
    freeBusy: async () => [{ start: "2026-09-01T10:00:00Z", end: "2026-09-01T11:00:00Z" }],
  } as CalendarProvider & { calls: typeof calls };
  return p as CalendarProvider & { calls: typeof calls };
}

const RANGO = ["2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z"] as const;

beforeEach(() => {
  g.__zeroCalEvents = undefined;
  g.__zeroExtCals = undefined;
  vi.restoreAllMocks();
});

describe("agenda única", () => {
  it("junta los eventos del calendario base y de la cuenta secundaria", async () => {
    const google = fake([ev("Reunión", "2026-09-01T09:00:00Z", "google")]);
    const outlook = fake([ev("Comité", "2026-09-01T12:00:00Z", "outlook")], "outlook");
    const m = new MergedCalendarProvider(google, "u1", [outlook]);

    const eventos = await m.listEvents(...RANGO);
    expect(eventos.map((e) => e.title)).toEqual(["Reunión", "Comité"]); // ordenados por hora
    expect(outlook.calls.list).toBe(1); // la cuenta secundaria SÍ se consulta
  });

  it("el mismo acto en las dos cuentas se enseña una vez, y gana el editable", async () => {
    const google = fake([ev("Daily", "2026-09-01T09:00:00Z", "google", "g1")]);
    const outlook = fake([ev("daily", "2026-09-01T09:00:30Z", "outlook", "o1")], "outlook");
    const m = new MergedCalendarProvider(google, "u1", [outlook]);

    const eventos = await m.listEvents(...RANGO);
    expect(eventos).toHaveLength(1);
    expect(eventos[0].id).toBe("g1"); // la copia de Google, que sí se puede editar
  });

  it("si una cuenta falla, la agenda sigue con el resto", async () => {
    const google = fake([ev("Reunión", "2026-09-01T09:00:00Z", "google")]);
    const outlook = fake([], "outlook");
    outlook.listEvents = async () => {
      throw new Error("Graph caído");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const m = new MergedCalendarProvider(google, "u1", [outlook]);

    expect(await m.listEvents(...RANGO)).toHaveLength(1);
  });

  it("la caché evita repetir las llamadas, y una escritura la tira", async () => {
    const google = fake([ev("Reunión", "2026-09-01T09:00:00Z", "google")]);
    const m = new MergedCalendarProvider(google, "u1");

    await m.listEvents(...RANGO);
    await m.listEvents(...RANGO);
    expect(google.calls.list).toBe(1); // la segunda salió de la caché

    await m.createEvent({ title: "Nuevo", start: "2026-09-01T18:00:00Z", end: "2026-09-01T19:00:00Z" });
    await m.listEvents(...RANGO);
    expect(google.calls.list).toBe(2); // tras crear, se vuelve a preguntar
  });

  it("cada usuario tiene su propia caché", async () => {
    const google = fake([ev("Reunión", "2026-09-01T09:00:00Z", "google")]);
    await new MergedCalendarProvider(google, "u1").listEvents(...RANGO);
    await new MergedCalendarProvider(google, "u2").listEvents(...RANGO);
    expect(google.calls.list).toBe(2);
    invalidateEvents("u1");
  });

  it("un evento de calendario enlazado no se puede editar ni borrar", async () => {
    const m = new MergedCalendarProvider(fake([]), "u1");
    await expect(m.updateEvent("ext:Festivos:x:1", { title: "no" })).rejects.toThrow(/solo lectura/);
    await expect(m.deleteEvent("ext:Festivos:x:1")).rejects.toThrow(/solo lectura/);
  });

  it("la ocupación suma las dos cuentas (no se proponen huecos pisados)", async () => {
    const google = fake([]);
    const outlook = fake([], "outlook");
    outlook.freeBusy = async () => [{ start: "2026-09-01T16:00:00Z", end: "2026-09-01T17:00:00Z" }];
    const m = new MergedCalendarProvider(google, "u1", [outlook]);

    const ocupado = await m.freeBusy(...RANGO);
    expect(ocupado).toHaveLength(2);
  });
});
