import { describe, it, expect, vi, afterEach } from "vitest";
import { MicrosoftCalendarProvider } from "./microsoft";

/** Calendario de Outlook (Graph) con fetch simulado. */

afterEach(() => vi.unstubAllGlobals());

function graphEvent(over: Record<string, unknown> = {}) {
  return {
    id: "ev1",
    subject: "Reunión con Marta",
    bodyPreview: "Repasar el presupuesto",
    isAllDay: false,
    location: { displayName: "Oficina" },
    start: { dateTime: "2026-08-14T10:00:00.0000000", timeZone: "UTC" },
    end: { dateTime: "2026-08-14T11:00:00.0000000", timeZone: "UTC" },
    attendees: [{ emailAddress: { address: "marta@acme.com" } }],
    ...over,
  };
}

/** Desde que ZERO lee TODOS los calendarios, cada consulta empieza por pedir
 *  la lista. Estas simulaciones devuelven una cuenta con un solo calendario. */
function esListaDeCalendarios(url: string): boolean {
  return url.includes("/me/calendars?");
}
const UN_CALENDARIO = () =>
  new Response(JSON.stringify({ value: [{ id: "def", isDefaultCalendar: true }] }), { status: 200 });

describe("MicrosoftCalendarProvider", () => {
  it("lista eventos con horas UTC bien formadas y datos mapeados", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (esListaDeCalendarios(String(url))) return UN_CALENDARIO();
        expect(String(url)).toContain("/calendarView?");
        expect(new Headers(init?.headers).get("Prefer")).toContain('outlook.timezone="UTC"');
        return new Response(JSON.stringify({ value: [graphEvent()] }), { status: 200 });
      }),
    );
    const events = await new MicrosoftCalendarProvider("tok").listEvents(
      "2026-08-14T00:00:00Z",
      "2026-08-15T00:00:00Z",
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: "Reunión con Marta",
      start: "2026-08-14T10:00:00Z",
      end: "2026-08-14T11:00:00Z",
      location: "Oficina",
      attendees: ["marta@acme.com"],
      source: "outlook",
    });
  });

  it("evento de día completo: fecha de Madrid, no la medianoche UTC corrida", async () => {
    // Medianoche de Madrid en verano = 22:00Z del día anterior.
    const allDay = graphEvent({
      isAllDay: true,
      start: { dateTime: "2026-08-13T22:00:00.0000000", timeZone: "UTC" },
      end: { dateTime: "2026-08-14T22:00:00.0000000", timeZone: "UTC" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        esListaDeCalendarios(String(url))
          ? UN_CALENDARIO()
          : new Response(JSON.stringify({ value: [allDay] }), { status: 200 }),
      ),
    );
    const [ev] = await new MicrosoftCalendarProvider("tok").listEvents(
      "2026-08-13T00:00:00Z",
      "2026-08-15T00:00:00Z",
    );
    expect(ev.allDay).toBe(true);
    expect(ev.start).toBe("2026-08-14");
  });

  it("crear con idempotencyKey no duplica si ya existe título+comienzo iguales", async () => {
    const existing = graphEvent();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (esListaDeCalendarios(String(url))) return UN_CALENDARIO();
      if (String(url).includes("/calendarView")) {
        return new Response(JSON.stringify({ value: [existing] }), { status: 200 });
      }
      throw new Error(`no debería crear: ${init?.method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const ev = await new MicrosoftCalendarProvider("tok").createEvent({
      title: "Reunión con Marta",
      start: "2026-08-14T10:00:00Z",
      end: "2026-08-14T11:00:00Z",
      idempotencyKey: "k1",
    });
    expect(ev.id).toBe("ev1");
    // Solo lectura: lista de calendarios + vista. Ninguna llamada de creación.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("crear evento nuevo manda subject y horas UTC a Graph", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (esListaDeCalendarios(String(url))) return UN_CALENDARIO();
      if (String(url).includes("/calendarView")) {
        return new Response(JSON.stringify({ value: [] }), { status: 200 });
      }
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body));
      expect(body.subject).toBe("Cita médico");
      expect(body.start).toEqual({ dateTime: "2026-08-20T08:30:00", timeZone: "UTC" });
      return new Response(
        JSON.stringify(
          graphEvent({
            id: "nuevo",
            subject: "Cita médico",
            start: { dateTime: "2026-08-20T08:30:00.0000000" },
            end: { dateTime: "2026-08-20T09:00:00.0000000" },
          }),
        ),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const ev = await new MicrosoftCalendarProvider("tok").createEvent({
      title: "Cita médico",
      start: "2026-08-20T10:30:00+02:00",
      end: "2026-08-20T11:00:00+02:00",
      idempotencyKey: "k2",
    });
    expect(ev.id).toBe("nuevo");
  });

  it("getEvent devuelve null en 404 en vez de reventar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    expect(await new MicrosoftCalendarProvider("tok").getEvent("nope")).toBeNull();
  });

  it("freeBusy usa los eventos con hora (ignora los de día completo)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        esListaDeCalendarios(String(url))
          ? UN_CALENDARIO()
          : new Response(
          JSON.stringify({
            value: [
              graphEvent(),
              graphEvent({
                id: "ev2",
                isAllDay: true,
                start: { dateTime: "2026-08-13T22:00:00.0000000" },
                end: { dateTime: "2026-08-14T22:00:00.0000000" },
              }),
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const busy = await new MicrosoftCalendarProvider("tok").freeBusy(
      "2026-08-14T00:00:00Z",
      "2026-08-15T00:00:00Z",
    );
    expect(busy).toEqual([{ start: "2026-08-14T10:00:00Z", end: "2026-08-14T11:00:00Z" }]);
  });
});
