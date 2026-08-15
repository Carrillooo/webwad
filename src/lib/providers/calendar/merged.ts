import { CalendarProvider, CalendarRef, CalendarEvent, CreateEventInput } from "../types";
import { listExternalEvents } from "../../calendar/external";

/**
 * Envuelve el calendario real (Google/Outlook/mock) y mezcla en las lecturas
 * los eventos de los calendarios ENLAZADOS por iCal. Solo lectura: cualquier
 * intento de tocar un evento externo (id "ext:…") se rechaza con claridad.
 * Las escrituras van siempre al calendario base.
 */
export class MergedCalendarProvider implements CalendarProvider {
  readonly kind: CalendarProvider["kind"];

  constructor(
    private base: CalendarProvider,
    private userId: string,
  ) {
    this.kind = base.kind;
  }

  private static readOnly(id: string): boolean {
    return id.startsWith("ext:");
  }

  async listCalendars(): Promise<CalendarRef[]> {
    return this.base.listCalendars();
  }

  async listEvents(rangeStartIso: string, rangeEndIso: string, calendarId?: string): Promise<CalendarEvent[]> {
    const [own, ext] = await Promise.all([
      this.base.listEvents(rangeStartIso, rangeEndIso, calendarId),
      listExternalEvents(this.userId, rangeStartIso, rangeEndIso),
    ]);
    return [...own, ...ext].sort((a, b) => a.start.localeCompare(b.start));
  }

  async getEvent(id: string, calendarId?: string): Promise<CalendarEvent | null> {
    if (MergedCalendarProvider.readOnly(id)) return null;
    return this.base.getEvent(id, calendarId);
  }

  async createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    return this.base.createEvent(input);
  }

  async updateEvent(id: string, patch: Partial<CreateEventInput>, calendarId?: string): Promise<CalendarEvent> {
    if (MergedCalendarProvider.readOnly(id)) {
      throw new Error("Ese evento viene de un calendario enlazado y es de solo lectura.");
    }
    return this.base.updateEvent(id, patch, calendarId);
  }

  async deleteEvent(id: string, calendarId?: string): Promise<void> {
    if (MergedCalendarProvider.readOnly(id)) {
      throw new Error("Ese evento viene de un calendario enlazado y es de solo lectura.");
    }
    return this.base.deleteEvent(id, calendarId);
  }

  async freeBusy(rangeStartIso: string, rangeEndIso: string, calendarId?: string): Promise<{ start: string; end: string }[]> {
    // Los enlazados también ocupan: contar sus eventos con hora como "ocupado"
    // evita proponer huecos pisando, p. ej., una clase del horario enlazado.
    const [own, ext] = await Promise.all([
      this.base.freeBusy(rangeStartIso, rangeEndIso, calendarId),
      listExternalEvents(this.userId, rangeStartIso, rangeEndIso),
    ]);
    return [...own, ...ext.filter((e) => !e.allDay).map((e) => ({ start: e.start, end: e.end }))];
  }
}
