import { TasksProvider, TaskList, TaskItem } from "../types";
import { demoStore } from "../../demo/store";

let counter = 2000;
function nextId() {
  counter += 1;
  return `tsk-${counter}`;
}

export class MockTasksProvider implements TasksProvider {
  readonly kind = "mock" as const;

  async listTaskLists(): Promise<TaskList[]> {
    return demoStore().taskLists;
  }

  async listTasks(listId?: string): Promise<TaskItem[]> {
    return demoStore().tasks.filter((t) => !listId || t.listId === listId);
  }

  async createTask(input: { listId?: string; title: string; notes?: string; due?: string }): Promise<TaskItem> {
    const store = demoStore();
    const t: TaskItem = {
      id: nextId(),
      listId: input.listId ?? store.taskLists[0].id,
      title: input.title,
      notes: input.notes,
      due: input.due,
      status: "needsAction",
    };
    store.tasks.unshift(t);
    return t;
  }

  async updateTask(id: string, patch: Partial<Pick<TaskItem, "title" | "notes" | "due">>): Promise<TaskItem> {
    const t = demoStore().tasks.find((x) => x.id === id);
    if (!t) throw new Error("Tarea no encontrada");
    Object.assign(t, patch);
    return t;
  }

  async completeTask(id: string): Promise<TaskItem> {
    const t = demoStore().tasks.find((x) => x.id === id);
    if (!t) throw new Error("Tarea no encontrada");
    t.status = "completed";
    t.completedAt = new Date().toISOString();
    return t;
  }

  async reopenTask(id: string): Promise<TaskItem> {
    const t = demoStore().tasks.find((x) => x.id === id);
    if (!t) throw new Error("Tarea no encontrada");
    t.status = "needsAction";
    t.completedAt = undefined;
    return t;
  }

  async deleteTask(id: string): Promise<void> {
    const store = demoStore();
    store.tasks = store.tasks.filter((t) => t.id !== id);
  }
}
