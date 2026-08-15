import { CalendarProvider, CalendarRef, CalendarEvent, CreateEventInput } from "../types";
import { listExternalEvents } from "../../calendar/external";
import { getCachedEvents, setCachedEvents, invalidateEvents } from "./cache";

/**
 * La agenda ÚNICA de ZERO: junta en una sola vista el calendario donde se
 * escribe (Google u Outlook), los demás calendarios conectados (si tienes las
 * dos cuentas, salen las dos) y los enlazados por iCal.
 *
 * - Lecturas: todas las fuentes en paralelo, sin duplicados.
 * - Escrituras: siempre al calendario base; los eventos de fuentes de solo
 *   lectura (iCal, o la cuenta secundaria) se rechazan con un motivo claro.
 */
export class MergedCalendarProvider implements CalendarProvider {
  readonly kind: CalendarProvider["kind"];

  constructor(
    private base: CalendarProvider,
    private userId: string,
    /** Cuentas adicionales que solo se leen (p. ej. Outlook cuando escribes en Google). */
    private readers: CalendarProvider[] = [],
  ) {
    this.kind = base.kind;
  }

  private static readOnly(id: string): boolean {
    return id.startsWith("ext:");
  }

  /** Dos apuntes del mismo acto (invitación que llega a Gmail y a Outlook, o
   *  un calendario suscrito en las dos cuentas) se enseñan UNA vez. */
  private static dedupe(events: CalendarEvent[]): CalendarEvent[] {
    const seen = new Set<string>();
    const out: CalendarEvent[] = [];
    for (const e of events) {
      const key = `${e.title.trim().toLowerCase()}|${e.start.slice(0, 16)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    }
    return out;
  }

  async listCalendars(): Promise<CalendarRef[]> {
    const lists = await Promise.all([
      this.base.listCalendars().catch(() => [] as CalendarRef[]),
      ...this.readers.map((r) => r.listCalendars().catch(() => [] as CalendarRef[])),
    ]);
    return lists.flat();
  }

  async listEvents(rangeStartIso: string, rangeEndIso: string, calendarId?: string): Promise<CalendarEvent[]> {
    // Con un calendario concreto no hay nada que mezclar ni que cachear.
    if (calendarId) return this.base.listEvents(rangeStartIso, rangeEndIso, calendarId);

    const cached = getCachedEvents(this.userId, rangeStartIso, rangeEndIso);
    if (cached) return cached;

    const groups = await Promise.all([
      this.base.listEvents(rangeStartIso, rangeEndIso).catch((e) => {
        console.error("el calendario principal falló", e);
        return [] as CalendarEvent[];
      }),
      ...this.readers.map((r) =>
        r.listEvents(rangeStartIso, rangeEndIso).catch((e) => {
          console.error("una cuenta secundaria de calendario falló", e);
          return [] as CalendarEvent[];
        }),
      ),
      listExternalEvents(this.userId, rangeStartIso, rangeEndIso),
    ]);
    // El orden importa: primero el calendario donde se escribe, para que al
    // quitar duplicados sobreviva la copia que SÍ se puede editar.
    const merged = MergedCalendarProvider.dedupe(groups.flat()).sort((a, b) =>
      a.start.localeCompare(b.start),
    );
    setCachedEvents(this.userId, rangeStartIso, rangeEndIso, merged);
    return merged;
  }

  async getEvent(id: string, calendarId?: string): Promise<CalendarEvent | null> {
    if (MergedCalendarProvider.readOnly(id)) return null;
    return this.base.getEvent(id, calendarId);
  }

  async createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    const ev = await this.base.createEvent(input);
    invalidateEvents(this.userId);
    return ev;
  }

  async updateEvent(id: string, patch: Partial<CreateEventInput>, calendarId?: string): Promise<CalendarEvent> {
    if (MergedCalendarProvider.readOnly(id)) {
      throw new Error("Ese evento viene de un calendario enlazado y es de solo lectura.");
    }
    const ev = await this.base.updateEvent(id, patch, calendarId);
    invalidateEvents(this.userId);
    return ev;
  }

  async deleteEvent(id: string, calendarId?: string): Promise<void> {
    if (MergedCalendarProvider.readOnly(id)) {
      throw new Error("Ese evento viene de un calendario enlazado y es de solo lectura.");
    }
    await this.base.deleteEvent(id, calendarId);
    invalidateEvents(this.userId);
  }

  async freeBusy(
    rangeStartIso: string,
    rangeEndIso: string,
    calendarId?: string,
  ): Promise<{ start: string; end: string }[]> {
    if (calendarId) return this.base.freeBusy(rangeStartIso, rangeEndIso, calendarId);
    // Ocupa TODO lo que se ve: si no, ZERO propondría un hueco encima de una
    // reunión que está en la otra cuenta o en un calendario enlazado.
    const [own, ...rest] = await Promise.all([
      this.base.freeBusy(rangeStartIso, rangeEndIso).catch(() => [] as { start: string; end: string }[]),
      ...this.readers.map((r) =>
        r.freeBusy(rangeStartIso, rangeEndIso).catch(() => [] as { start: string; end: string }[]),
      ),
    ]);
    const externos = (await listExternalEvents(this.userId, rangeStartIso, rangeEndIso))
      .filter((e) => !e.allDay)
      .map((e) => ({ start: e.start, end: e.end }));
    return [...own, ...rest.flat(), ...externos];
  }
}
