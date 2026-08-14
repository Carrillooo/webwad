import { CalendarProvider, CalendarRef, CalendarEvent, CreateEventInput } from "../types";

const GRAPH = "https://graph.microsoft.com/v1.0";
const TZ = "Europe/Madrid";

/**
 * Calendario de Outlook vía Microsoft Graph. Se usa como calendario principal
 * cuando el usuario tiene Outlook conectado y NO tiene Google: así, al enlazar
 * su cuenta Microsoft, todos los eventos que ya tenía aparecen en ZERO.
 *
 * Fechas: pedimos a Graph la hora en UTC (`Prefer: outlook.timezone="UTC"`) y
 * publicamos ISO con `Z`; los eventos de día completo se datan en Madrid.
 */

interface MEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
  location?: { displayName?: string };
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  attendees?: { emailAddress?: { address?: string } }[];
  onlineMeeting?: { joinUrl?: string };
  showAs?: string;
}

/** "2026-08-14T10:00:00.0000000" (UTC de Graph) → "2026-08-14T10:00:00Z". */
function utcIso(graphDateTime?: string): string {
  if (!graphDateTime) return "";
  return `${graphDateTime.replace(/\.\d+$/, "")}Z`;
}

/** Fecha (YYYY-MM-DD) de ese instante UTC vista desde Madrid. */
function madridDate(utc: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(utc));
}

/** ISO cualquiera → dateTime UTC sin sufijo, como lo quiere Graph. */
function toGraphUtc(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19);
}

export class MicrosoftCalendarProvider implements CalendarProvider {
  readonly kind = "outlook" as const;
  constructor(private accessToken: string) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${GRAPH}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Prefer: 'outlook.timezone="UTC"',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      const err = new Error(`Outlook Calendar ${res.status}: ${text.slice(0, 200)}`) as Error & {
        status?: number;
      };
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  private map(e: MEvent, calendarId: string): CalendarEvent {
    const startUtc = utcIso(e.start?.dateTime);
    const endUtc = utcIso(e.end?.dateTime);
    const allDay = Boolean(e.isAllDay);
    return {
      id: e.id,
      calendarId,
      title: e.subject ?? "(sin título)",
      // Día completo: Graph da medianoche del huso del evento pasada a UTC;
      // la fecha correcta es la de Madrid de ese instante.
      start: allDay && startUtc ? madridDate(startUtc) : startUtc,
      end: allDay && endUtc ? madridDate(endUtc) : endUtc,
      allDay,
      location: e.location?.displayName || undefined,
      description: e.bodyPreview || undefined,
      attendees: e.attendees
        ?.map((a) => a.emailAddress?.address ?? "")
        .filter((a) => a.length > 0),
      hangoutLink: e.onlineMeeting?.joinUrl,
      source: "outlook",
    };
  }

  async listCalendars(): Promise<CalendarRef[]> {
    const j = await this.req<{ value: { id: string; name?: string; isDefaultCalendar?: boolean }[] }>(
      "GET",
      "/me/calendars?$top=50",
    );
    return j.value.map((c) => ({
      id: c.id,
      summary: c.name ?? "(sin nombre)",
      primary: Boolean(c.isDefaultCalendar),
    }));
  }

  async listEvents(rangeStartIso: string, rangeEndIso: string): Promise<CalendarEvent[]> {
    const qs = new URLSearchParams({
      startDateTime: new Date(rangeStartIso).toISOString(),
      endDateTime: new Date(rangeEndIso).toISOString(),
      $top: "200",
      $orderby: "start/dateTime",
    });
    const j = await this.req<{ value: MEvent[] }>("GET", `/me/calendarView?${qs.toString()}`);
    return j.value.filter((e) => !e.isCancelled).map((e) => this.map(e, "primary"));
  }

  async getEvent(id: string): Promise<CalendarEvent | null> {
    try {
      const e = await this.req<MEvent>("GET", `/me/events/${encodeURIComponent(id)}`);
      return this.map(e, "primary");
    } catch (err) {
      if ((err as { status?: number }).status === 404) return null;
      throw err;
    }
  }

  private toGraphEvent(input: Partial<CreateEventInput>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (input.title !== undefined) out.subject = input.title;
    if (input.description !== undefined) {
      out.body = { contentType: "text", content: input.description };
    }
    if (input.location !== undefined) out.location = { displayName: input.location };
    if (input.attendees !== undefined) {
      out.attendees = input.attendees.map((a) => ({
        emailAddress: { address: a },
        type: "required",
      }));
    }
    if (input.allDay) {
      out.isAllDay = true;
      if (input.start) out.start = { dateTime: `${input.start.slice(0, 10)}T00:00:00`, timeZone: TZ };
      if (input.end) out.end = { dateTime: `${input.end.slice(0, 10)}T00:00:00`, timeZone: TZ };
    } else {
      if (input.start) out.start = { dateTime: toGraphUtc(input.start), timeZone: "UTC" };
      if (input.end) out.end = { dateTime: toGraphUtc(input.end), timeZone: "UTC" };
    }
    return out;
  }

  async createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    // Idempotencia sin ids de cliente (Graph no los admite): si ya existe un
    // evento con el mismo título y el mismo comienzo, lo devolvemos sin crear.
    if (input.idempotencyKey) {
      try {
        const startMs = new Date(input.start).getTime();
        const nearby = await this.listEvents(
          new Date(startMs - 86_400_000).toISOString(),
          new Date(startMs + 86_400_000).toISOString(),
        );
        const dup = nearby.find(
          (e) =>
            e.title === input.title &&
            (e.allDay
              ? e.start === input.start.slice(0, 10)
              : new Date(e.start).getTime() === startMs),
        );
        if (dup) return dup;
      } catch {
        /* si la comprobación falla, se crea igualmente */
      }
    }
    const e = await this.req<MEvent>("POST", "/me/events", this.toGraphEvent(input));
    return this.map(e, "primary");
  }

  async updateEvent(id: string, patch: Partial<CreateEventInput>): Promise<CalendarEvent> {
    const e = await this.req<MEvent>(
      "PATCH",
      `/me/events/${encodeURIComponent(id)}`,
      this.toGraphEvent(patch),
    );
    return this.map(e, "primary");
  }

  async deleteEvent(id: string): Promise<void> {
    await this.req<void>("DELETE", `/me/events/${encodeURIComponent(id)}`);
  }

  async freeBusy(rangeStartIso: string, rangeEndIso: string): Promise<{ start: string; end: string }[]> {
    const events = await this.listEvents(rangeStartIso, rangeEndIso);
    return events
      .filter((e) => !e.allDay)
      .map((e) => ({ start: e.start, end: e.end }));
  }
}
