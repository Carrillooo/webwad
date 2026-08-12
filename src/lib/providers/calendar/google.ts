import { createHash } from "node:crypto";
import { CalendarProvider, CalendarRef, CalendarEvent, CreateEventInput } from "../types";

const BASE = "https://www.googleapis.com/calendar/v3";
const TZ = "Europe/Madrid";

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

  async listEvents(startIso: string, endIso: string, calendarId = "primary"): Promise<CalendarEvent[]> {
    const p = new URLSearchParams({
      timeMin: new Date(startIso).toISOString(),
      timeMax: new Date(endIso).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    const data = await this.req<{ items: GEvent[] }>("GET", `/calendars/${encodeURIComponent(calendarId)}/events?${p}`);
    return (data.items ?? []).filter((e) => e.status !== "cancelled").map((e) => this.map(e, calendarId));
  }

  async getEvent(id: string, calendarId = "primary"): Promise<CalendarEvent | null> {
    try {
      const e = await this.req<GEvent>("GET", `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`);
      return this.map(e, calendarId);
    } catch (err) {
      if ((err as { status?: number }).status === 404) return null;
      throw err;
    }
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

  async updateEvent(id: string, patch: Partial<CreateEventInput>, calendarId = "primary"): Promise<CalendarEvent> {
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

  async deleteEvent(id: string, calendarId = "primary"): Promise<void> {
    await this.req<void>("DELETE", `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`);
  }

  async freeBusy(startIso: string, endIso: string, calendarId = "primary"): Promise<{ start: string; end: string }[]> {
    const data = await this.req<{ calendars: Record<string, { busy: { start: string; end: string }[] }> }>(
      "POST",
      "/freeBusy",
      { timeMin: new Date(startIso).toISOString(), timeMax: new Date(endIso).toISOString(), items: [{ id: calendarId }] },
    );
    return data.calendars?.[calendarId]?.busy ?? [];
  }
}
