import { TasksProvider, TaskList, TaskItem } from "../types";

const G = "https://graph.microsoft.com/v1.0";

interface GTodoTask {
  id: string;
  title?: string;
  status?: string;
  body?: { content?: string };
  dueDateTime?: { dateTime?: string };
  completedDateTime?: { dateTime?: string };
}

/** Outlook tasks (Microsoft To Do) via the official Graph API. */
export class MicrosoftTasksProvider implements TasksProvider {
  readonly kind = "google" as const; // interface tag; real backend is Microsoft Graph
  constructor(private accessToken: string) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${G}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Microsoft Graph ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  private map(t: GTodoTask, listId: string): TaskItem {
    return {
      id: t.id,
      listId,
      title: t.title ?? "(sin título)",
      notes: t.body?.content?.trim() || undefined,
      due: t.dueDateTime?.dateTime ? t.dueDateTime.dateTime.slice(0, 10) : undefined,
      status: t.status === "completed" ? "completed" : "needsAction",
      completedAt: t.completedDateTime?.dateTime,
    };
  }

  async listTaskLists(): Promise<TaskList[]> {
    const data = await this.req<{ value: { id: string; displayName: string }[] }>("GET", "/me/todo/lists");
    return (data.value ?? []).map((l) => ({ id: l.id, title: l.displayName }));
  }

  private async defaultList(listId?: string): Promise<string> {
    if (listId) return listId;
    const lists = await this.listTaskLists();
    return lists[0]?.id ?? "";
  }

  async listTasks(listId?: string): Promise<TaskItem[]> {
    const id = await this.defaultList(listId);
    if (!id) return [];
    const data = await this.req<{ value: GTodoTask[] }>("GET", `/me/todo/lists/${encodeURIComponent(id)}/tasks?$top=100`);
    return (data.value ?? []).map((t) => this.map(t, id));
  }

  async createTask(input: { listId?: string; title: string; notes?: string; due?: string }): Promise<TaskItem> {
    const id = await this.defaultList(input.listId);
    const body: Record<string, unknown> = { title: input.title };
    if (input.notes) body.body = { content: input.notes, contentType: "text" };
    if (input.due) body.dueDateTime = { dateTime: `${input.due}T00:00:00.0000000`, timeZone: "Europe/Madrid" };
    const t = await this.req<GTodoTask>("POST", `/me/todo/lists/${encodeURIComponent(id)}/tasks`, body);
    return this.map(t, id);
  }

  async updateTask(id: string, patch: Partial<Pick<TaskItem, "title" | "notes" | "due">>, listId?: string): Promise<TaskItem> {
    const list = await this.defaultList(listId);
    const body: Record<string, unknown> = {};
    if (patch.title !== undefined) body.title = patch.title;
    if (patch.notes !== undefined) body.body = { content: patch.notes ?? "", contentType: "text" };
    if (patch.due !== undefined)
      body.dueDateTime = patch.due ? { dateTime: `${patch.due}T00:00:00.0000000`, timeZone: "Europe/Madrid" } : null;
    const t = await this.req<GTodoTask>("PATCH", `/me/todo/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(id)}`, body);
    return this.map(t, list);
  }

  async completeTask(id: string, listId?: string): Promise<TaskItem> {
    const list = await this.defaultList(listId);
    const t = await this.req<GTodoTask>(
      "PATCH",
      `/me/todo/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(id)}`,
      { status: "completed" },
    );
    return this.map(t, list);
  }

  async reopenTask(id: string, listId?: string): Promise<TaskItem> {
    const list = await this.defaultList(listId);
    const t = await this.req<GTodoTask>(
      "PATCH",
      `/me/todo/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(id)}`,
      { status: "notStarted" },
    );
    return this.map(t, list);
  }

  async deleteTask(id: string, listId?: string): Promise<void> {
    const list = await this.defaultList(listId);
    await this.req<void>("DELETE", `/me/todo/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(id)}`);
  }
}
