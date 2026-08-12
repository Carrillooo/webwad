import {
  CalendarProvider,
  CalendarRef,
  CalendarEvent,
  CreateEventInput,
} from "../types";
import { demoStore } from "../../demo/store";

let counter = 1000;
function nextId() {
  counter += 1;
  return `evt-${counter}`;
}

/** Demo calendar backed by the in-memory store. Mutations are "instant". */
export class MockCalendarProvider implements CalendarProvider {
  readonly kind = "mock" as const;

  async listCalendars(): Promise<CalendarRef[]> {
    return [
      { id: "primary", summary: "Principal", primary: true, backgroundColor: "#7c5cff" },
      { id: "work", summary: "Trabajo", backgroundColor: "#38bdf8" },
      { id: "personal", summary: "Personal", backgroundColor: "#34d399" },
    ];
  }

  async listEvents(startIso: string, endIso: string, calendarId?: string): Promise<CalendarEvent[]> {
    const s = new Date(startIso).getTime();
    const e = new Date(endIso).getTime();
    return demoStore()
      .events.filter((ev) => {
        if (calendarId && ev.calendarId !== calendarId) return false;
        const es = new Date(ev.start).getTime();
        return es >= s && es <= e;
      })
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  async getEvent(id: string): Promise<CalendarEvent | null> {
    return demoStore().events.find((e) => e.id === id) ?? null;
  }

  async createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    const store = demoStore();
    if (input.idempotencyKey) {
      const existing = store.events.find((e) => e.id === `evt-idem-${input.idempotencyKey}`);
      if (existing) return existing;
    }
    const ev: CalendarEvent = {
      id: input.idempotencyKey ? `evt-idem-${input.idempotencyKey}` : nextId(),
      calendarId: input.calendarId ?? "primary",
      title: input.title,
      start: input.start,
      end: input.end,
      allDay: input.allDay,
      location: input.location,
      description: input.description,
      attendees: input.attendees,
      hangoutLink: input.addConference ? "https://meet.google.com/demo-nova" : undefined,
      source: "mock",
    };
    store.events.push(ev);
    return ev;
  }

  async updateEvent(id: string, patch: Partial<CreateEventInput>): Promise<CalendarEvent> {
    const store = demoStore();
    const ev = store.events.find((e) => e.id === id);
    if (!ev) throw new Error("Evento no encontrado");
    Object.assign(ev, {
      title: patch.title ?? ev.title,
      start: patch.start ?? ev.start,
      end: patch.end ?? ev.end,
      location: patch.location ?? ev.location,
      description: patch.description ?? ev.description,
    });
    return ev;
  }

  async deleteEvent(id: string): Promise<void> {
    const store = demoStore();
    store.events = store.events.filter((e) => e.id !== id);
  }

  async freeBusy(startIso: string, endIso: string, calendarId?: string) {
    const evts = await this.listEvents(startIso, endIso, calendarId);
    return evts.filter((e) => !e.allDay).map((e) => ({ start: e.start, end: e.end }));
  }
}
