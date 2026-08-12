import { TasksProvider, TaskList, TaskItem } from "../types";

const BASE = "https://tasks.googleapis.com/tasks/v1";

interface GTask {
  id: string;
  title?: string;
  notes?: string;
  due?: string;
  status?: "needsAction" | "completed";
  completed?: string;
}

/** Real Google Tasks via the official REST API. Google Tasks only stores a
 *  date (no time) for `due`; time-of-day intents should use Calendar instead. */
export class GoogleTasksProvider implements TasksProvider {
  readonly kind = "google" as const;
  constructor(private accessToken: string) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Google Tasks ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  private map(t: GTask, listId: string): TaskItem {
    return {
      id: t.id,
      listId,
      title: t.title ?? "(sin título)",
      notes: t.notes,
      due: t.due ? t.due.slice(0, 10) : undefined,
      status: t.status === "completed" ? "completed" : "needsAction",
      completedAt: t.completed,
    };
  }

  async listTaskLists(): Promise<TaskList[]> {
    const data = await this.req<{ items: { id: string; title: string }[] }>("GET", "/users/@me/lists");
    return (data.items ?? []).map((l) => ({ id: l.id, title: l.title }));
  }

  private async defaultList(listId?: string): Promise<string> {
    if (listId) return listId;
    const lists = await this.listTaskLists();
    return lists[0]?.id ?? "@default";
  }

  async listTasks(listId?: string): Promise<TaskItem[]> {
    const id = await this.defaultList(listId);
    const data = await this.req<{ items: GTask[] }>(
      "GET",
      `/lists/${encodeURIComponent(id)}/tasks?showCompleted=true&showHidden=true&maxResults=100`,
    );
    return (data.items ?? []).map((t) => this.map(t, id));
  }

  async createTask(input: { listId?: string; title: string; notes?: string; due?: string }): Promise<TaskItem> {
    const id = await this.defaultList(input.listId);
    const body: Record<string, unknown> = { title: input.title, notes: input.notes };
    if (input.due) body.due = `${input.due}T00:00:00.000Z`;
    const t = await this.req<GTask>("POST", `/lists/${encodeURIComponent(id)}/tasks`, body);
    return this.map(t, id);
  }

  async updateTask(id: string, patch: Partial<Pick<TaskItem, "title" | "notes" | "due">>, listId?: string): Promise<TaskItem> {
    const list = await this.defaultList(listId);
    const body: Record<string, unknown> = {};
    if (patch.title !== undefined) body.title = patch.title;
    if (patch.notes !== undefined) body.notes = patch.notes;
    if (patch.due !== undefined) body.due = patch.due ? `${patch.due}T00:00:00.000Z` : null;
    const t = await this.req<GTask>("PATCH", `/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(id)}`, body);
    return this.map(t, list);
  }

  async completeTask(id: string, listId?: string): Promise<TaskItem> {
    const list = await this.defaultList(listId);
    const t = await this.req<GTask>("PATCH", `/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(id)}`, {
      status: "completed",
    });
    return this.map(t, list);
  }

  async reopenTask(id: string, listId?: string): Promise<TaskItem> {
    const list = await this.defaultList(listId);
    const t = await this.req<GTask>("PATCH", `/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(id)}`, {
      status: "needsAction",
      completed: null,
    });
    return this.map(t, list);
  }

  async deleteTask(id: string, listId?: string): Promise<void> {
    const list = await this.defaultList(listId);
    await this.req<void>("DELETE", `/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(id)}`);
  }
}
