/**
 * Provider factory. Chooses Mock vs real implementations based on config and
 * the user's Google connection. Tasks/Documents remain mock until Phases 5/6.
 */
import { serverConfig } from "../config";
import { CalendarProvider, TasksProvider, DocumentsProvider } from "./types";
import { MockCalendarProvider } from "./calendar/mock";
import { MockTasksProvider } from "./tasks/mock";
import { MockDocumentsProvider } from "./documents/mock";
import { GoogleCalendarProvider } from "./calendar/google";
import { GoogleTasksProvider } from "./tasks/google";
import { GoogleDocumentsProvider } from "./documents/google";
import { isGoogleConfigured } from "../google/oauth";
import { getAccessToken } from "../google/connection";

export interface Providers {
  calendar: CalendarProvider;
  tasks: TasksProvider;
  documents: DocumentsProvider;
  demoMode: boolean;
}

function mocks(): Providers {
  return {
    calendar: new MockCalendarProvider(),
    tasks: new MockTasksProvider(),
    documents: new MockDocumentsProvider(),
    demoMode: true,
  };
}

/** Synchronous demo factory (mocks only). Used where no user context exists. */
export function getProviders(): Providers {
  return mocks();
}

/**
 * Resolve providers for a specific user. Returns the real Google Calendar when
 * Google is configured and the user has a valid connection; otherwise mocks.
 * Never throws — any failure degrades to the mock so the app stays usable.
 */
export async function resolveProviders(userId: string, authed: boolean): Promise<Providers> {
  if (serverConfig.demoMode || !isGoogleConfigured()) return mocks();
  try {
    const token = await getAccessToken(userId, authed);
    if (!token) return mocks();
    return {
      calendar: new GoogleCalendarProvider(token),
      tasks: new GoogleTasksProvider(token),
      documents: new GoogleDocumentsProvider(token),
      demoMode: false,
    };
  } catch {
    return mocks();
  }
}
