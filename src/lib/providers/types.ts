/**
 * Provider abstractions. Every external capability is behind an interface so
 * the app runs fully on Mock implementations and swaps to Google/Anthropic
 * implementations once credentials exist. See docs/ARCHITECTURE.md.
 *
 * IMPORTANT: any string field originating from an external service
 * (event title/description, doc content, task notes...) is UNTRUSTED_DATA and
 * must be treated as such when fed to the assistant. See docs/SECURITY.md.
 */

// ----------------------------- Calendar -----------------------------

export interface CalendarRef {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  /** ISO-8601 with timezone offset (Europe/Madrid). */
  start: string;
  end: string;
  allDay?: boolean;
  location?: string;
  description?: string;
  attendees?: string[];
  hangoutLink?: string;
  /** true until the backing service has confirmed persistence. */
  pending?: boolean;
  source?: "mock" | "google" | "outlook";
}

export interface FreeSlot {
  start: string;
  end: string;
  minutes: number;
}

export interface CreateEventInput {
  calendarId?: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  location?: string;
  description?: string;
  attendees?: string[];
  addConference?: boolean;
  idempotencyKey?: string;
}

export interface CalendarProvider {
  readonly kind: "mock" | "google" | "outlook";
  listCalendars(): Promise<CalendarRef[]>;
  listEvents(rangeStartIso: string, rangeEndIso: string, calendarId?: string): Promise<CalendarEvent[]>;
  getEvent(id: string, calendarId?: string): Promise<CalendarEvent | null>;
  createEvent(input: CreateEventInput): Promise<CalendarEvent>;
  updateEvent(id: string, patch: Partial<CreateEventInput>, calendarId?: string): Promise<CalendarEvent>;
  deleteEvent(id: string, calendarId?: string): Promise<void>;
  /** Busy intervals within range; used for conflict detection + free slots. */
  freeBusy(rangeStartIso: string, rangeEndIso: string, calendarId?: string): Promise<{ start: string; end: string }[]>;
}

// ------------------------------- Tasks ------------------------------

export interface TaskList {
  id: string;
  title: string;
}

export interface TaskItem {
  id: string;
  listId: string;
  title: string;
  notes?: string;
  /** RFC3339 date (Google Tasks only stores date, not time). */
  due?: string;
  status: "needsAction" | "completed";
  completedAt?: string;
}

export interface TasksProvider {
  readonly kind: "mock" | "google" | "outlook";
  listTaskLists(): Promise<TaskList[]>;
  listTasks(listId?: string): Promise<TaskItem[]>;
  createTask(input: { listId?: string; title: string; notes?: string; due?: string }): Promise<TaskItem>;
  updateTask(id: string, patch: Partial<Pick<TaskItem, "title" | "notes" | "due">>, listId?: string): Promise<TaskItem>;
  completeTask(id: string, listId?: string): Promise<TaskItem>;
  reopenTask(id: string, listId?: string): Promise<TaskItem>;
  deleteTask(id: string, listId?: string): Promise<void>;
}

// ---------------------------- Documents -----------------------------

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface DocContent {
  id: string;
  title: string;
  /** Plain-text extraction. UNTRUSTED. */
  text: string;
}

export interface DocSummary {
  executive: string;
  keyPoints: string[];
  tasks: string[];
  dates: string[];
  decisions: string[];
  people: string[];
}

export interface DocumentsProvider {
  readonly kind: "mock" | "google" | "outlook";
  searchFiles(query: string): Promise<DriveFile[]>;
  recentFiles(limit?: number): Promise<DriveFile[]>;
  getDocument(id: string): Promise<DocContent | null>;
  createDocument(title: string, text?: string): Promise<DriveFile>;
  appendDocument(id: string, text: string): Promise<void>;
  updateDocument(id: string, text: string, confirmOverwrite: boolean): Promise<void>;
}

// --------------------------- Assistant ------------------------------

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

/** Result of one assistant turn. */
export interface AssistantTurn {
  /** Spoken/displayed reply. */
  reply: string;
  /** Which monitor view ZERO should surface. */
  view?: "home" | "calendar" | "tasks" | "documents" | "planner" | "briefing" | "history";
  /** Structured actions the client already executed/should reflect. */
  receipts?: ActionReceipt[];
  /** Proposal that needs explicit user confirmation before executing. */
  proposal?: Proposal | null;
  /** Focus hint for the calendar view (ISO day). */
  focusDate?: string;
}

export interface ActionReceipt {
  id: string;
  at: string;
  kind: string; // e.g. "event.create", "task.complete"
  label: string;
  ok: boolean;
  undoable?: boolean;
  detail?: string;
}

export interface Proposal {
  id: string;
  kind: "plan" | "conflict" | "overwrite" | "delete";
  summary: string;
  blocks?: { title: string; start: string; end: string }[];
  risk: "low" | "medium" | "high";
}

export interface AssistantContext {
  ownerName: string;
  nowIso: string;
  timezone: string;
  demoMode: boolean;
  /** Desde dónde saldrían los emails de este usuario ("adrian@gmail.com (Gmail)");
   *  null/ausente = no hay forma de enviar. */
  mailFrom?: string | null;
}

/** Runtime conversation state threaded across turns for follow-ups. */
export interface ConversationState {
  /** Proposal awaiting a yes/no from a previous turn. */
  pendingProposal?: Proposal | null;
  /** Events most recently shown, for "muévelo / el segundo" references. */
  recentEventIds?: string[];
  /** Last created event id, for "deshacer". */
  lastCreatedEventId?: string;
  /** Bulk deletion awaiting confirmation ("borra todas las tareas/eventos"). */
  pendingBulk?: { type: "tasks" | "events"; startIso?: string; endIso?: string } | null;
  /** Event with resolved times but unknown title — waiting for the name. */
  pendingEventDraft?: { startIso: string; endIso: string; dayLabel: string } | null;
}

export interface AssistantProvider {
  readonly kind: "mock" | "anthropic";
  respond(
    history: AssistantMessage[],
    ctx: AssistantContext,
    state?: ConversationState,
  ): Promise<AssistantTurn & { state?: ConversationState }>;
}
