/**
 * In-memory demo store, shared by all Mock* providers on the server.
 *
 * Persists for the lifetime of the server process (resets on restart) — good
 * enough for DEMO_MODE. Real providers replace this with Google + Supabase.
 * Data is seeded relative to "now" so today/tomorrow always have content.
 */
import { CalendarEvent, TaskItem, TaskList, DriveFile, DocContent } from "../providers/types";
import { toZonedIso, makeZonedInstant, nowZoned, addDaysZoned } from "../datetime";
import { serverConfig } from "../config";

interface DemoState {
  events: CalendarEvent[];
  taskLists: TaskList[];
  tasks: TaskItem[];
  files: DriveFile[];
  docs: Record<string, DocContent>;
  seeded: boolean;
}

// Survive Next.js dev hot-reload by stashing on globalThis.
const g = globalThis as unknown as { __novaDemo?: DemoState };

function eventAt(day: Date, offsetDays: number, sh: number, sm: number, eh: number, em: number) {
  const target = addDaysZoned(day, offsetDays);
  const z = nowZoned(target);
  const y = z.getFullYear();
  const m = z.getMonth() + 1;
  const d = z.getDate();
  return {
    start: toZonedIso(makeZonedInstant(y, m, d, sh, sm)),
    end: toZonedIso(makeZonedInstant(y, m, d, eh, em)),
  };
}

function seed(): DemoState {
  // FINAL mode: without an explicit DEMO_MODE=true there is no prefab data —
  // the local store starts clean (it still works as scratch storage until
  // Google is connected).
  if (!serverConfig.demoMode) {
    return {
      events: [],
      taskLists: [{ id: "list-1", title: "Mis tareas" }],
      tasks: [],
      files: [],
      docs: {},
      seeded: true,
    };
  }

  const now = new Date();
  const mkId = (p: string, n: number) => `${p}-${n}`;

  // Today has a morning meeting and an evening block (used to demo conflicts).
  // Tomorrow is deliberately free at 19:30 so the flagship command
  // "añádeme entrenamiento mañana a las 19:30" creates cleanly.
  const t0 = eventAt(now, 0, 10, 0, 11, 0);
  const t1 = eventAt(now, 0, 17, 30, 18, 30);
  const t2 = eventAt(now, 0, 20, 0, 21, 30);
  const t3 = eventAt(now, 1, 9, 30, 10, 30);

  const events: CalendarEvent[] = [
    { id: mkId("evt", 1), calendarId: "primary", title: "Reunión de equipo", ...t0, location: "Sala Norte", source: "mock" },
    { id: mkId("evt", 2), calendarId: "primary", title: "Revisión de presupuesto", ...t1, source: "mock" },
    { id: mkId("evt", 3), calendarId: "primary", title: "Entrenamiento", ...t2, location: "Gimnasio", source: "mock" },
    { id: mkId("evt", 4), calendarId: "primary", title: "Llamada con proveedor", ...t3, source: "mock" },
  ];

  const taskLists: TaskList[] = [{ id: "list-1", title: "Mis tareas" }];
  const dueTomorrow = toZonedIso(addDaysZoned(now, 1)).slice(0, 10);
  const tasks: TaskItem[] = [
    { id: "tsk-1", listId: "list-1", title: "Preparar presupuesto 2026", status: "needsAction", due: dueTomorrow },
    { id: "tsk-2", listId: "list-1", title: "Llamar al proveedor", status: "needsAction" },
    { id: "tsk-3", listId: "list-1", title: "Enviar informe mensual", status: "needsAction" },
  ];

  const files: DriveFile[] = [
    { id: "doc-1", name: "Presupuesto 2026", mimeType: "application/vnd.google-apps.document", modifiedTime: toZonedIso(now), webViewLink: "#" },
    { id: "doc-2", name: "Propuesta comercial", mimeType: "application/vnd.google-apps.document", modifiedTime: toZonedIso(addDaysZoned(now, -2)), webViewLink: "#" },
    { id: "doc-3", name: "Notas de reunión", mimeType: "application/vnd.google-apps.document", modifiedTime: toZonedIso(addDaysZoned(now, -5)), webViewLink: "#" },
  ];

  const docs: Record<string, DocContent> = {
    "doc-1": {
      id: "doc-1",
      title: "Presupuesto 2026",
      text: "Presupuesto 2026. Objetivo de ingresos: 1,2M€. Reducir costes operativos un 8%. Decisión: aprobar inversión en marketing digital. Responsable: Daniel. Fecha límite de revisión: 15 de septiembre. Personas: equipo de finanzas, dirección.",
    },
    "doc-2": {
      id: "doc-2",
      title: "Propuesta comercial",
      text: "Propuesta comercial para cliente estratégico. Puntos clave: descuento por volumen, entrega en 30 días, soporte prioritario. Tareas: enviar contrato, agendar reunión de cierre. Decisión pendiente: aprobar condiciones de pago. Fecha: reunión el viernes.",
    },
  };

  return { events, taskLists, tasks, files, docs, seeded: true };
}

export function demoStore(): DemoState {
  if (!g.__novaDemo) g.__novaDemo = seed();
  return g.__novaDemo;
}

/** Test helper: force a fresh seed. */
export function resetDemoStore(): void {
  g.__novaDemo = seed();
}
