import { createHash } from "node:crypto";
import { CalendarProvider, CalendarRef, CalendarEvent, CreateEventInput } from "../types";
import { getCachedCalendarIds, setCachedCalendarIds } from "./cache";

const BASE = "https://www.googleapis.com/calendar/v3";
const TZ = "Europe/Madrid";
/** Tope de calendarios por cuenta: más que esto es ruido y latencia. */
const MAX_CALENDARS = 15;

interface GEvent {
  id: string;
  summary?: string;
  location?: string;
  description?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string }[];
  status?: string;
}

/** Real Google Calendar via the official REST API. Access token is resolved
 *  per request by the connection store (refreshes automatically). */
export class GoogleCalendarProvider implements CalendarProvider {
  readonly kind = "google" as const;
  constructor(private accessToken: string) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      const err = new Error(`Google Calendar ${res.status}: ${text.slice(0, 200)}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  private map(e: GEvent, calendarId: string): CalendarEvent {
    const allDay = !!e.start?.date;
    return {
      id: e.id,
      calendarId,
      title: e.summary ?? "(sin título)",
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      allDay,
      location: e.location,
      description: e.description,
      attendees: e.attendees?.map((a) => a.email),
      hangoutLink: e.hangoutLink,
      source: "google",
    };
  }

  async listCalendars(): Promise<CalendarRef[]> {
    const data = await this.req<{ items: { id: string; summary: string; primary?: boolean; backgroundColor?: string }[] }>(
      "GET",
      "/users/me/calendarList",
    );
    return (data.items ?? []).map((c) => ({
      id: c.id,
      summary: c.summary,
      primary: c.primary,
      backgroundColor: c.backgroundColor,
    }));
  }

  /** Ids de TODOS los calendarios del usuario (el suyo, los compartidos y los
   *  suscritos). Cacheados unos minutos: cambian rarísima vez y ahorran una
   *  llamada en cada consulta de agenda. */
  private async allCalendarIds(): Promise<string[]> {
    const cached = getCachedCalendarIds(this.accessToken);
    if (cached) return cached;
    const data = await this.req<{
      items: { id: string; deleted?: boolean; selected?: boolean; primary?: boolean }[];
    }>("GET", "/users/me/calendarList?maxResults=250&showDeleted=false&showHidden=false");
    const items = (data.items ?? []).filter((c) => !c.deleted);
    // Primero el principal y los que el usuario tiene marcados como visibles:
    // si hay muchísimos, el tope se lleva los que menos le importan.
    const ordered = [
      ...items.filter((c) => c.primary),
      ...items.filter((c) => !c.primary && c.selected !== false),
      ...items.filter((c) => !c.primary && c.selected === false),
    ];
    const ids = ordered.map((c) => c.id).slice(0, MAX_CALENDARS);
    setCachedCalendarIds(this.accessToken, ids);
    return ids;
  }

  private async eventsOfCalendar(calendarId: string, startIso: string, endIso: string): Promise<CalendarEvent[]> {
    const p = new URLSearchParams({
      timeMin: new Date(startIso).toISOString(),
      timeMax: new Date(endIso).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    const data = await this.req<{ items: GEvent[] }>("GET", `/calendars/${encodeURIComponent(calendarId)}/events?${p}`);
    return (data.items ?? [])
      .filter((e) => e.status !== "cancelled")
      .map((e) => this.map(e, calendarId));
  }

  /**
   * Sin calendarId: TODOS los calendarios a la vez (en paralelo). Antes solo
   * se miraba "primary", así que los calendarios compartidos o suscritos —el
   * del trabajo, el del colegio, los festivos— no aparecían en ZERO.
   */
  async listEvents(startIso: string, endIso: string, calendarId?: string): Promise<CalendarEvent[]> {
    if (calendarId) return this.eventsOfCalendar(calendarId, startIso, endIso);
    const ids = await this.allCalendarIds().catch(() => ["primary"]);
    const perCalendar = await Promise.all(
      // Un calendario que falle (permiso raro, borrado a media consulta) no
      // puede dejar al usuario sin agenda: se ignora y siguen los demás.
      ids.map((id) =>
        this.eventsOfCalendar(id, startIso, endIso).catch((e) => {
          console.error(`calendario de Google "${id}" no se pudo leer`, e);
          return [] as CalendarEvent[];
        }),
      ),
    );
    return perCalendar.flat().sort((a, b) => a.start.localeCompare(b.start));
  }

  private async eventOf(id: string, calendarId: string): Promise<CalendarEvent | null> {
    try {
      const e = await this.req<GEvent>("GET", `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`);
      return this.map(e, calendarId);
    } catch (err) {
      if ((err as { status?: number }).status === 404) return null;
      throw err;
    }
  }

  /**
   * En qué calendario vive un evento. Ahora que ZERO enseña los eventos de
   * TODOS los calendarios, mover o borrar uno del calendario del trabajo no
   * puede fallar por buscarlo solo en el principal.
   */
  private async calendarOf(id: string): Promise<string> {
    const enPrimary = await this.eventOf(id, "primary").catch(() => null);
    if (enPrimary) return "primary";
    const ids = (await this.allCalendarIds().catch(() => [])).filter((c) => c !== "primary");
    const found = await Promise.all(
      ids.map(async (c) => ((await this.eventOf(id, c).catch(() => null)) ? c : null)),
    );
    return found.find((c): c is string => c !== null) ?? "primary";
  }

  async getEvent(id: string, calendarId?: string): Promise<CalendarEvent | null> {
    return this.eventOf(id, calendarId ?? (await this.calendarOf(id)));
  }

  async createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    const calendarId = input.calendarId ?? "primary";
    const body: Record<string, unknown> = {
      summary: input.title,
      location: input.location,
      description: input.description,
      attendees: input.attendees?.map((email) => ({ email })),
    };
    if (input.allDay) {
      body.start = { date: input.start.slice(0, 10) };
      body.end = { date: input.end.slice(0, 10) };
    } else {
      body.start = { dateTime: input.start, timeZone: TZ };
      body.end = { dateTime: input.end, timeZone: TZ };
    }
    // Deterministic id from idempotency key (valid chars: a-v, 0-9).
    if (input.idempotencyKey) {
      body.id = "nova" + createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 32);
    }
    let query = "";
    if (input.addConference) {
      body.conferenceData = { createRequest: { requestId: `nova-${Date.now()}` } };
      query = "?conferenceDataVersion=1";
    }
    try {
      const e = await this.req<GEvent>("POST", `/calendars/${encodeURIComponent(calendarId)}/events${query}`, body);
      return this.map(e, calendarId);
    } catch (err) {
      // 409 → event with this idempotent id already exists; return it.
      if ((err as { status?: number }).status === 409 && body.id) {
        const existing = await this.getEvent(body.id as string, calendarId);
        if (existing) return existing;
      }
      throw err;
    }
  }

  async updateEvent(id: string, patch: Partial<CreateEventInput>, calendarIdArg?: string): Promise<CalendarEvent> {
    const calendarId = calendarIdArg ?? (await this.calendarOf(id));
    const body: Record<string, unknown> = {};
    if (patch.title !== undefined) body.summary = patch.title;
    if (patch.location !== undefined) body.location = patch.location;
    if (patch.description !== undefined) body.description = patch.description;
    if (patch.start) body.start = { dateTime: patch.start, timeZone: TZ };
    if (patch.end) body.end = { dateTime: patch.end, timeZone: TZ };
    const e = await this.req<GEvent>(
      "PATCH",
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`,
      body,
    );
    return this.map(e, calendarId);
  }

  async deleteEvent(id: string, calendarIdArg?: string): Promise<void> {
    const calendarId = calendarIdArg ?? (await this.calendarOf(id));
    await this.req<void>("DELETE", `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`);
  }

  /** Ocupación de TODOS los calendarios (o de uno, si se pide). Así ZERO no
   *  propone un hueco encima de algo que está en otro calendario. */
  async freeBusy(startIso: string, endIso: string, calendarId?: string): Promise<{ start: string; end: string }[]> {
    const ids = calendarId ? [calendarId] : await this.allCalendarIds().catch(() => ["primary"]);
    const data = await this.req<{ calendars: Record<string, { busy: { start: string; end: string }[] }> }>(
      "POST",
      "/freeBusy",
      {
        timeMin: new Date(startIso).toISOString(),
        timeMax: new Date(endIso).toISOString(),
        // La API admite hasta 50 calendarios por consulta.
        items: ids.slice(0, 50).map((id) => ({ id })),
      },
    );
    return Object.values(data.calendars ?? {}).flatMap((c) => c.busy ?? []);
  }
}
