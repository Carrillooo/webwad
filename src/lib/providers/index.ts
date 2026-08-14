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
import { GoogleSheetsProvider } from "./sheets/google";
import { SheetsProvider } from "./sheets/types";
import { MicrosoftTasksProvider } from "./tasks/microsoft";
import { MicrosoftCalendarProvider } from "./calendar/microsoft";
import { isGoogleConfigured } from "../google/oauth";
import { getAccessToken } from "../google/connection";
import { isMicrosoftConfigured } from "../microsoft/oauth";
import { getMsAccessToken } from "../microsoft/connection";

export interface Providers {
  calendar: CalendarProvider;
  tasks: TasksProvider;
  documents: DocumentsProvider;
  /** Present only when Google is connected (no mock equivalent). */
  sheets?: SheetsProvider;
  /** Present only when Outlook (Microsoft To Do) is connected. */
  outlookTasks?: TasksProvider;
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
  let providers: Providers = mocks();

  if (!serverConfig.demoMode && isGoogleConfigured()) {
    try {
      const token = await getAccessToken(userId, authed);
      if (token) {
        providers = {
          calendar: new GoogleCalendarProvider(token),
          tasks: new GoogleTasksProvider(token),
          documents: new GoogleDocumentsProvider(token),
          sheets: new GoogleSheetsProvider(token),
          demoMode: false,
        };
      }
    } catch {
      /* keep mocks */
    }
  }

  // Outlook attaches independently of Google (tasks may live only there).
  if (!serverConfig.demoMode && isMicrosoftConfigured()) {
    try {
      const msToken = await getMsAccessToken(userId, authed);
      if (msToken) {
        providers.outlookTasks = new MicrosoftTasksProvider(msToken);
        // Sin Google, el calendario real es el de Outlook: al enlazar la
        // cuenta Microsoft aparecen todos los eventos que ya tenía.
        if (providers.calendar.kind === "mock") {
          providers.calendar = new MicrosoftCalendarProvider(msToken);
          providers.demoMode = false;
        }
      }
    } catch {
      /* leave outlook off */
    }
  }

  return providers;
}
