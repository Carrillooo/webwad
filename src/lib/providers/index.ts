/**
 * Provider factory. Chooses Mock* vs real implementations based on config and
 * (future) per-user Google connection state. Today everything resolves to
 * Mock* because no external credentials are wired yet — see PROGRESS.md.
 */
import { serverConfig } from "../config";
import { CalendarProvider, TasksProvider, DocumentsProvider } from "./types";
import { MockCalendarProvider } from "./calendar/mock";
import { MockTasksProvider } from "./tasks/mock";
import { MockDocumentsProvider } from "./documents/mock";

export interface Providers {
  calendar: CalendarProvider;
  tasks: TasksProvider;
  documents: DocumentsProvider;
  demoMode: boolean;
}

/**
 * @param userId — reserved for per-user Google credential lookup (Phase 4).
 */
export function getProviders(_userId?: string): Providers {
  const googleConfigured =
    serverConfig.google.clientId.length > 0 && serverConfig.google.clientSecret.length > 0;

  // Phase 4 will branch on googleConfigured + a valid connection for userId.
  // For now we always use mocks so the whole app is exercisable.
  const useMock = serverConfig.demoMode || !googleConfigured;

  if (useMock) {
    return {
      calendar: new MockCalendarProvider(),
      tasks: new MockTasksProvider(),
      documents: new MockDocumentsProvider(),
      demoMode: true,
    };
  }

  // TODO(Phase 4): return Google* providers here.
  return {
    calendar: new MockCalendarProvider(),
    tasks: new MockTasksProvider(),
    documents: new MockDocumentsProvider(),
    demoMode: true,
  };
}
