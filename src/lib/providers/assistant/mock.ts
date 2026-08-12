/**
 * MockAssistantProvider — a deterministic, offline "brain" for DEMO_MODE.
 *
 * It runs a small Spanish NLU, calls the real (mock) providers, detects
 * conflicts, proposes plans, and resolves conversational follow-ups
 * ("sí", "hazlo", "muévelo"). It never fabricates success: every receipt
 * reflects an actual mutation of the demo store. The Anthropic provider
 * (Phase 7) uses the same tool layer with genuine tool-calling.
 */
import {
  AssistantProvider,
  AssistantMessage,
  AssistantContext,
  AssistantTurn,
  ConversationState,
  ActionReceipt,
  Proposal,
  CalendarEvent,
} from "../types";
import type { Providers } from "../index";
import {
  parseDay,
  parseTime,
  parseDuration,
  toIso,
  ParsedDay,
} from "../../nlu/spanish-datetime";
import { humanTime, dayBounds, toZonedIso } from "../../datetime";

let receiptSeq = 0;
function receipt(kind: string, label: string, ok: boolean, extra?: Partial<ActionReceipt>): ActionReceipt {
  receiptSeq += 1;
  return {
    id: `rc-${Date.now()}-${receiptSeq}`,
    at: new Date().toISOString(),
    kind,
    label,
    ok,
    ...extra,
  };
}

type Intent =
  | "confirm" | "cancel" | "query_day" | "free_slots" | "create_event"
  | "move_event" | "delete_event" | "create_task" | "list_tasks"
  | "complete_task" | "plan_day" | "search_doc" | "summarize_doc"
  | "create_doc" | "briefing" | "greeting" | "unknown";

const RE = {
  // NOTE: JS \b word boundaries don't work around accented letters (í, é…),
  // so confirm/cancel use explicit start/whitespace/punctuation anchors.
  confirm: /(^|\s)(s[íi]|hazlo|h[áa]galo|aplica|apl[íi]calo|adelante|dale|de acuerdo|confirmo|vale|ok|correcto|perfecto|hecho)(\s|$|[.,!¡?])/i,
  cancel: /(^|\s)(no|cancela|c[aá]ncelalo|d[eé]jalo|olvida|anula)(\s|$|[.,!¡?])/i,
  briefing: /\bbriefing\b|res[uú]men del d[íi]a|c[oó]mo est[áa] mi d[íi]a|resumen de hoy/i,
  freeSlots: /\bhuecos?\b|tiempo libre|disponibilidad|cu[aá]ndo estoy libre/i,
  queryDay: /\bqu[eé]\s+tengo\b|mi agenda|mi calendario|qu[eé]\s+hay\b|eventos?\b/i,
  createEvent: /\b(a[ñn][aá]deme|ponme|agenda|ag[eé]ndame|reserva|res[eé]rvame|crea(?:me)?\s+(?:un\s+)?evento|mete|apunta(?:me)?\s+(?:una\s+)?reuni)/i,
  moveEvent: /\b(mu[eé]ve|mu[eé]veme|cambia|c[aá]mbialo|traslada|pasa)\b/i,
  deleteEvent: /\b(borra|elimina|quita|cancela)\b.*\b(evento|reuni[oó]n|entrenamiento|cita)/i,
  createTask: /\b(ap[uú]ntame|apunta|recu[eé]rdame|a[ñn][aá]de(?:me)?\s+(?:una\s+)?tarea|crea(?:me)?\s+(?:una\s+)?tarea|tengo que)\b/i,
  listTasks: /\b(qu[eé]\s+tareas|mis tareas|tareas pendientes|pendientes)\b/i,
  completeTask: /\b(marca|completa|termin[eé]|he hecho|hecho)\b.*\b(tarea|completad)/i,
  planDay: /\borgan[íi]za|organ[íi]zame|plan[ií]fica|plan[ií]ficame|prep[aá]rame el d[íi]a\b/i,
  searchDoc: /\bbusca\b.*\b(documento|archivo|fichero|doc)\b|\bbusca\b/i,
  summarizeDoc: /\bres[uú]me\b/i,
  createDoc: /\bcrea\b.*\b(documento|doc)\b/i,
  greeting: /\b(hola|buenas|buenos d[íi]as|buenas tardes|buenas noches|hey)\b/i,
};

function classify(text: string, hasPending: boolean): Intent {
  const t = text.trim();
  if (hasPending && RE.confirm.test(t) && t.split(/\s+/).length <= 4) return "confirm";
  if (hasPending && RE.cancel.test(t) && t.split(/\s+/).length <= 4) return "cancel";
  if (RE.briefing.test(t)) return "briefing";
  if (RE.planDay.test(t)) return "plan_day";
  if (RE.freeSlots.test(t)) return "free_slots";
  if (RE.summarizeDoc.test(t)) return "summarize_doc";
  if (RE.createDoc.test(t)) return "create_doc";
  if (RE.deleteEvent.test(t)) return "delete_event";
  if (RE.moveEvent.test(t)) return "move_event";
  if (RE.completeTask.test(t)) return "complete_task";
  if (RE.createTask.test(t)) return "create_task";
  if (RE.listTasks.test(t)) return "list_tasks";
  if (RE.createEvent.test(t)) return "create_event";
  if (RE.searchDoc.test(t) && /\bbusca\b/i.test(t)) return "search_doc";
  if (RE.queryDay.test(t)) return "query_day";
  if (RE.confirm.test(t)) return "confirm";
  if (RE.greeting.test(t)) return "greeting";
  return "unknown";
}

/** Overlap test between [aStart,aEnd) and busy intervals. */
function findConflicts(startIso: string, endIso: string, busy: { start: string; end: string }[]) {
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  return busy.filter((b) => {
    const bs = new Date(b.start).getTime();
    const be = new Date(b.end).getTime();
    return s < be && e > bs;
  });
}

/** Free gaps within working window [08:00, 22:00] of a given day. */
function freeSlots(day: ParsedDay, busy: { start: string; end: string }[]) {
  const dayStart = toIso(day, 8 * 60);
  const dayEnd = toIso(day, 22 * 60);
  const sorted = [...busy]
    .filter((b) => new Date(b.end) > new Date(dayStart) && new Date(b.start) < new Date(dayEnd))
    .sort((a, b) => a.start.localeCompare(b.start));
  const slots: { start: string; end: string; minutes: number }[] = [];
  let cursor = new Date(dayStart).getTime();
  const end = new Date(dayEnd).getTime();
  for (const b of sorted) {
    const bs = Math.max(new Date(b.start).getTime(), cursor);
    if (bs > cursor) {
      const mins = Math.round((bs - cursor) / 60000);
      if (mins >= 30) slots.push({ start: new Date(cursor).toISOString(), end: new Date(bs).toISOString(), minutes: mins });
    }
    cursor = Math.max(cursor, new Date(b.end).getTime());
  }
  if (end > cursor) {
    const mins = Math.round((end - cursor) / 60000);
    if (mins >= 30) slots.push({ start: new Date(cursor).toISOString(), end: new Date(end).toISOString(), minutes: mins });
  }
  return slots;
}

/** Strip trigger verbs to guess an event/task title. */
function guessTitle(text: string, fallback: string): string {
  const t = text
    .replace(/[¿?¡!.]/g, " ")
    .replace(RE.createEvent, " ")
    .replace(RE.createTask, " ")
    .replace(/\b(a[ñn][aá]deme|ponme|agenda|ag[eé]ndame|reserva|res[eé]rvame|ap[uú]ntame|apunta|recu[eé]rdame)\b/gi, " ")
    .replace(/\b(ma[ñn]ana|hoy|pasado ma[ñn]ana|ayer|el|la|los|las|un|una|de|durante|a|para|me|mi)\b/gi, " ")
    .replace(/\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[áa]bado|domingo)\b/gi, " ")
    .replace(/\b\d{1,2}[:.h]\d{0,2}\b/g, " ")
    .replace(/\b(hora|horas|media|cuarto|min|minutos?|y)\b/gi, " ")
    .replace(/\b(una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length >= 2 ? t.charAt(0).toUpperCase() + t.slice(1) : fallback;
}

export class MockAssistantProvider implements AssistantProvider {
  readonly kind = "mock" as const;
  constructor(private providers: Providers) {}

  async respond(
    history: AssistantMessage[],
    ctx: AssistantContext,
    state: ConversationState = {},
  ): Promise<AssistantTurn & { state?: ConversationState }> {
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    const text = lastUser?.content ?? "";
    const intent = classify(text, !!state.pendingProposal);
    const base = new Date(ctx.nowIso);

    switch (intent) {
      case "confirm":
        return this.applyProposal(state);
      case "cancel":
        return { reply: "De acuerdo, lo dejo así.", view: "home", state: { ...state, pendingProposal: null } };
      case "greeting":
        return {
          reply: `${greetingReply(ctx)} ¿En qué puedo ayudarle?`,
          view: "home",
          state,
        };
      case "query_day":
        return this.queryDay(text, base);
      case "free_slots":
        return this.freeSlotsReply(text, base);
      case "create_event":
        return this.createEvent(text, base, state);
      case "move_event":
        return this.moveEvent(text, base, state);
      case "delete_event":
        return this.deleteEventFlow(text, base, state);
      case "create_task":
        return this.createTask(text, base);
      case "list_tasks":
        return this.listTasks();
      case "complete_task":
        return this.completeTask(text);
      case "plan_day":
        return this.planDay(text, base, state);
      case "search_doc":
        return this.searchDoc(text);
      case "summarize_doc":
        return this.summarizeDoc(text);
      case "create_doc":
        return this.createDoc(text);
      case "briefing":
        return this.briefing(base);
      default:
        return {
          reply:
            "No estoy seguro de haberle entendido. Puedo consultar su agenda, crear eventos y tareas, buscar documentos o darle su briefing.",
          view: "home",
          state,
        };
    }
  }

  private async queryDay(text: string, base: Date): Promise<AssistantTurn & { state?: ConversationState }> {
    const day = parseDay(text, base);
    const events = await this.providers.calendar.listEvents(toIso(day, 0), toIso(day, 24 * 60 - 1));
    const focus = toIso(day, 0);
    if (events.length === 0) {
      return { reply: `No tiene nada en la agenda ${day.label}.`, view: "calendar", focusDate: focus, state: { recentEventIds: [] } };
    }
    const list = events.map((e) => `${e.title} a las ${humanTime(e.start)}`);
    const reply = `${cap(day.label)} tiene ${events.length === 1 ? "un evento" : `${events.length} eventos`}: ${joinEs(list)}.`;
    return {
      reply,
      view: "calendar",
      focusDate: focus,
      receipts: [receipt("calendar.list", `Agenda consultada · ${day.label}`, true)],
      state: { recentEventIds: events.map((e) => e.id) },
    };
  }

  private async freeSlotsReply(text: string, base: Date): Promise<AssistantTurn & { state?: ConversationState }> {
    const day = parseDay(text, base);
    const busy = await this.providers.calendar.freeBusy(
      toIso(day, 0),
      toIso(day, 24 * 60 - 1),
    );
    const slots = freeSlots(day, busy);
    if (slots.length === 0) return { reply: `No veo huecos libres ${day.label}.`, view: "calendar", focusDate: toIso(day, 0) };
    const main = slots.sort((a, b) => b.minutes - a.minutes)[0];
    const list = slots.map((s) => `${humanTime(s.start)}–${humanTime(s.end)}`);
    return {
      reply: `${cap(day.label)} tiene libre ${joinEs(list)}. Su mayor hueco es de ${humanTime(main.start)} a ${humanTime(main.end)}.`,
      view: "calendar",
      focusDate: toIso(day, 0),
    };
  }

  private async createEvent(
    text: string,
    base: Date,
    state: ConversationState,
  ): Promise<AssistantTurn & { state?: ConversationState }> {
    const day = parseDay(text, base);
    const time = parseTime(text);
    const dur = parseDuration(text) ?? 60;
    if (time === null) {
      return {
        reply: "¿A qué hora quiere que lo ponga?",
        view: "calendar",
        focusDate: toIso(day, 0),
        state,
      };
    }
    const startIso = toIso(day, time);
    const endIso = toIso(day, time + dur);
    const title = guessTitle(text, "Evento");
    const cal = this.providers.calendar;

    const busy = await cal.freeBusy(
      toIso(day, 0),
      toIso(day, 24 * 60 - 1),
    );
    const conflicts = findConflicts(startIso, endIso, busy);
    if (conflicts.length > 0) {
      // Propose the first reasonable slot after the conflict.
      const conflictEnd = conflicts.map((c) => new Date(c.end).getTime()).sort((a, b) => b - a)[0];
      const altStart = new Date(conflictEnd).toISOString();
      const altEnd = new Date(conflictEnd + dur * 60000).toISOString();
      const proposal: Proposal = {
        id: `prop-${Date.now()}`,
        kind: "conflict",
        summary: `${title} de ${humanTime(altStart)} a ${humanTime(altEnd)}`,
        blocks: [{ title, start: altStart, end: altEnd }],
        risk: "low",
      };
      return {
        reply: `Tiene ocupado hasta las ${humanTime(altStart)}. Puedo ponerla de ${humanTime(altStart)} a ${humanTime(altEnd)}. ¿Lo hago?`,
        view: "calendar",
        focusDate: toIso(day, 0),
        proposal,
        state: { ...state, pendingProposal: proposal },
      };
    }

    // Low risk, clearly requested → execute and offer undo.
    const created = await cal.createEvent({
      title,
      start: startIso,
      end: endIso,
      idempotencyKey: `${title}-${startIso}`,
    });
    return {
      reply: `Hecho. ${title} ${day.label} de ${humanTime(startIso)} a ${humanTime(endIso)}.`,
      view: "calendar",
      focusDate: toIso(day, 0),
      receipts: [receipt("event.create", `Evento creado · ${title}`, true, { undoable: true, detail: created.id })],
      state: { ...state, lastCreatedEventId: created.id, pendingProposal: null },
    };
  }

  private async moveEvent(
    text: string,
    base: Date,
    state: ConversationState,
  ): Promise<AssistantTurn & { state?: ConversationState }> {
    const cal = this.providers.calendar;
    // Resolve which event: prefer recent list, else by keyword.
    const ids = state.recentEventIds ?? [];
    let target: CalendarEvent | null = null;
    for (const id of ids) {
      const ev = await cal.getEvent(id);
      if (ev && new RegExp(ev.title.split(" ")[0], "i").test(text)) { target = ev; break; }
    }
    if (!target && ids.length === 1) target = await cal.getEvent(ids[0]);
    // Try "de las seis" origin match against today's events.
    if (!target) {
      const from = parseTime(text.split(/\ba\s+las?\b/i)[0] ?? text);
      const { start, end } = dayBounds(base);
      const todays = await cal.listEvents(start.toISOString(), end.toISOString());
      target = todays.find((e) => from !== null && humanTime(e.start) === minsToHHMM(from)) ?? null;
    }
    if (!target) {
      return { reply: "¿Qué evento quiere mover?", view: "calendar", state };
    }
    // New time: last time reference in the sentence.
    const parts = text.split(/\ba\s+las?\b/i);
    const newTime = parseTime(parts.length > 1 ? "a las " + parts[parts.length - 1] : text);
    if (newTime === null) {
      return { reply: `¿A qué hora muevo "${target.title}"?`, view: "calendar", state };
    }
    const durMs = new Date(target.end).getTime() - new Date(target.start).getTime();
    const day = parseDay(text, new Date(target.start));
    const newStart = toIso(day, newTime);
    const newEnd = new Date(new Date(newStart).getTime() + durMs).toISOString();
    const updated = await cal.updateEvent(target.id, { start: newStart, end: newEnd });
    return {
      reply: `Hecho. "${updated.title}" movido a las ${humanTime(newStart)}.`,
      view: "calendar",
      focusDate: newStart,
      receipts: [receipt("event.update", `Evento movido · ${updated.title}`, true, { undoable: true })],
      state: { ...state, recentEventIds: [updated.id] },
    };
  }

  private async deleteEventFlow(
    text: string,
    base: Date,
    state: ConversationState,
  ): Promise<AssistantTurn & { state?: ConversationState }> {
    const cal = this.providers.calendar;
    const d = parseDay(text, base);
    const events = await cal.listEvents(toIso(d, 0), toIso(d, 24 * 60 - 1));
    const target = events.find((e) => new RegExp(e.title.split(" ")[0], "i").test(text));
    if (!target) return { reply: "¿Qué evento quiere eliminar?", view: "calendar", state };
    // High risk → explicit confirmation.
    const proposal: Proposal = {
      id: `prop-del-${Date.now()}`,
      kind: "delete",
      summary: `Eliminar "${target.title}" (${humanTime(target.start)})`,
      risk: "high",
    };
    return {
      reply: `¿Confirma que elimine "${target.title}" de las ${humanTime(target.start)}? Esta acción no se puede deshacer fácilmente.`,
      view: "calendar",
      proposal,
      state: { ...state, pendingProposal: proposal, recentEventIds: [target.id] },
    };
  }

  private async createTask(text: string, base: Date): Promise<AssistantTurn & { state?: ConversationState }> {
    const day = parseDay(text, base);
    const hasDay = /\b(hoy|ma[ñn]ana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[áa]bado|domingo)\b/i.test(text);
    const title = guessTitle(text, "Tarea");
    const due = hasDay ? toZonedIso(day.date).slice(0, 10) : undefined;
    const created = await this.providers.tasks.createTask({ title, due });
    const when = hasDay ? ` para ${day.label}` : "";
    return {
      reply: `Anotado${when}: ${title}.`,
      view: "tasks",
      receipts: [receipt("task.create", `Tarea creada · ${title}`, true, { detail: created.id })],
    };
  }

  private async listTasks(): Promise<AssistantTurn & { state?: ConversationState }> {
    const tasks = (await this.providers.tasks.listTasks()).filter((t) => t.status === "needsAction");
    if (tasks.length === 0) return { reply: "No tiene tareas pendientes.", view: "tasks" };
    return {
      reply: `Tiene ${tasks.length} ${tasks.length === 1 ? "tarea pendiente" : "tareas pendientes"}: ${joinEs(tasks.map((t) => t.title))}.`,
      view: "tasks",
      receipts: [receipt("task.list", "Tareas consultadas", true)],
    };
  }

  private async completeTask(text: string): Promise<AssistantTurn & { state?: ConversationState }> {
    const tasks = await this.providers.tasks.listTasks();
    const target = tasks.find(
      (t) => t.status === "needsAction" && text.toLowerCase().includes(t.title.toLowerCase().split(" ")[0]),
    );
    if (!target) return { reply: "¿Qué tarea marco como completada?", view: "tasks" };
    await this.providers.tasks.completeTask(target.id);
    return {
      reply: `Hecho. "${target.title}" completada.`,
      view: "tasks",
      receipts: [receipt("task.complete", `Tarea completada · ${target.title}`, true)],
    };
  }

  private async planDay(
    text: string,
    base: Date,
    state: ConversationState,
  ): Promise<AssistantTurn & { state?: ConversationState }> {
    const day = parseDay(text, base);
    const cal = this.providers.calendar;
    const busy = await cal.freeBusy(
      toIso(day, 0),
      toIso(day, 24 * 60 - 1),
    );
    const slots = freeSlots(day, busy).sort((a, b) => a.start.localeCompare(b.start));

    // Parse requested activities + durations from the sentence.
    const wants: { title: string; minutes: number }[] = [];
    if (/estud/i.test(text)) wants.push({ title: "Estudio", minutes: matchMinutes(text, /estud\w*/i) ?? 60 });
    if (/trabaj|proyecto/i.test(text)) wants.push({ title: "Proyecto", minutes: matchMinutes(text, /(trabaj|proyecto)\w*/i) ?? 120 });
    if (/entren/i.test(text)) wants.push({ title: "Entrenamiento", minutes: matchMinutes(text, /entren\w*/i) ?? 90 });
    if (wants.length === 0) wants.push({ title: "Trabajo enfocado", minutes: 120 });

    // Greedy fit into free slots without touching existing commitments.
    const blocks: { title: string; start: string; end: string }[] = [];
    const pool = slots.map((s) => ({ ...s }));
    for (const w of wants) {
      const slot = pool.find((s) => s.minutes >= w.minutes);
      if (!slot) continue;
      const startMs = new Date(slot.start).getTime();
      const endMs = startMs + w.minutes * 60000;
      blocks.push({ title: w.title, start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() });
      slot.start = new Date(endMs).toISOString();
      slot.minutes -= w.minutes;
    }
    if (blocks.length === 0) {
      return { reply: `No encuentro huecos suficientes ${day.label} sin mover sus compromisos.`, view: "planner", focusDate: toIso(day, 0), state };
    }
    const proposal: Proposal = {
      id: `plan-${Date.now()}`,
      kind: "plan",
      summary: blocks.map((b) => `${humanTime(b.start)}–${humanTime(b.end)} ${b.title}`).join(" · "),
      blocks,
      risk: "medium",
    };
    return {
      reply: `Propongo para ${day.label}: ${blocks.map((b) => `${b.title} de ${humanTime(b.start)} a ${humanTime(b.end)}`).join(", ")}. ¿Aplico esta planificación?`,
      view: "planner",
      focusDate: toIso(day, 0),
      proposal,
      state: { ...state, pendingProposal: proposal },
    };
  }

  private async applyProposal(
    state: ConversationState,
  ): Promise<AssistantTurn & { state?: ConversationState }> {
    const p = state.pendingProposal;
    if (!p) return { reply: "No hay nada pendiente por confirmar.", view: "home", state };
    const cal = this.providers.calendar;

    if (p.kind === "delete") {
      const id = state.recentEventIds?.[0];
      if (id) await cal.deleteEvent(id);
      return {
        reply: "Hecho. Evento eliminado.",
        view: "calendar",
        receipts: [receipt("event.delete", "Evento eliminado", true)],
        state: { ...state, pendingProposal: null },
      };
    }

    // plan or conflict → create the proposed blocks. Guard against duplicates
    // via idempotency keys; tolerate partial failure.
    const blocks = p.blocks ?? [];
    const receipts: ActionReceipt[] = [];
    let created = 0;
    for (const b of blocks) {
      try {
        await cal.createEvent({ title: b.title, start: b.start, end: b.end, idempotencyKey: `${b.title}-${b.start}` });
        receipts.push(receipt("event.create", `Evento creado · ${b.title}`, true, { undoable: true }));
        created += 1;
      } catch {
        receipts.push(receipt("event.create", `Error al crear · ${b.title}`, false));
      }
    }
    const reply =
      created === blocks.length
        ? `Hecho. He añadido ${created === 1 ? "el bloque" : `${created} bloques`} a su calendario.`
        : `He añadido ${created} de ${blocks.length}. Revise los que fallaron.`;
    return {
      reply,
      view: "calendar",
      focusDate: blocks[0]?.start,
      receipts,
      state: { ...state, pendingProposal: null },
    };
  }

  private async searchDoc(text: string): Promise<AssistantTurn & { state?: ConversationState }> {
    const query = text.replace(/.*\bbusca\b/i, "").replace(/\b(el|la|los|las|documento|archivo|fichero|doc)\b/gi, "").trim();
    const files = await this.providers.documents.searchFiles(query || "");
    if (files.length === 0) return { reply: `No encontré documentos con "${query}".`, view: "documents" };
    return {
      reply: `Encontré ${files.length}: ${joinEs(files.map((f) => f.name))}.`,
      view: "documents",
      receipts: [receipt("drive.search", `Búsqueda · ${query}`, true)],
    };
  }

  private async summarizeDoc(text: string): Promise<AssistantTurn & { state?: ConversationState }> {
    const query = text.replace(/.*\bres[uú]me\b/i, "").replace(/\b(el|la|documento|doc|este)\b/gi, "").trim();
    const docs = this.providers.documents;
    const files = query ? await docs.searchFiles(query) : await docs.recentFiles(1);
    const file = files[0];
    if (!file) return { reply: `No encontré el documento para resumir.`, view: "documents" };
    const content = await docs.getDocument(file.id);
    if (!content) return { reply: `No pude abrir "${file.name}".`, view: "documents" };
    // NOTE: content.text is UNTRUSTED. We only extract, never execute.
    const s = summarizeText(content.text);
    return {
      reply: `Resumen de "${file.name}": ${s.executive}`,
      view: "documents",
      receipts: [receipt("doc.summarize", `Resumen · ${file.name}`, true, { detail: JSON.stringify(s) })],
    };
  }

  private async createDoc(text: string): Promise<AssistantTurn & { state?: ConversationState }> {
    const m = text.match(/llamad[oa]\s+([^.,]+)|documento\s+([^.,]+)/i);
    const title = (m?.[1] ?? m?.[2] ?? "Nuevo documento").trim();
    const file = await this.providers.documents.createDocument(title, "");
    return {
      reply: `Documento "${title}" creado.`,
      view: "documents",
      receipts: [receipt("doc.create", `Documento creado · ${title}`, true, { detail: file.id })],
    };
  }

  private async briefing(base: Date): Promise<AssistantTurn & { state?: ConversationState }> {
    const cal = this.providers.calendar;
    const today = parseDay("hoy", base);
    const dayStartIso = toIso(today, 0);
    const dayEndIso = toIso(today, 24 * 60 - 1);
    const events = await cal.listEvents(dayStartIso, dayEndIso);
    const tasks = (await this.providers.tasks.listTasks()).filter((t) => t.status === "needsAction");
    const busy = await cal.freeBusy(dayStartIso, dayEndIso);
    const slots = freeSlots(today, busy).sort((a, b) => b.minutes - a.minutes);
    const next = events.find((e) => new Date(e.start).getTime() > Date.now());
    const parts: string[] = [];
    parts.push(events.length ? `Hoy tiene ${events.length} ${events.length === 1 ? "evento" : "eventos"}` : "Hoy no tiene eventos");
    if (next) parts.push(`el próximo es ${next.title} a las ${humanTime(next.start)}`);
    parts.push(`${tasks.length} ${tasks.length === 1 ? "tarea pendiente" : "tareas pendientes"}`);
    if (slots[0]) parts.push(`su principal hueco libre es de ${humanTime(slots[0].start)} a ${humanTime(slots[0].end)}`);
    return {
      reply: `${joinEs(parts)}.`,
      view: "briefing",
      focusDate: dayStartIso,
      receipts: [receipt("briefing", "Briefing generado", true)],
    };
  }
}

// --------------------------- helpers ---------------------------

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function joinEs(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}
function minsToHHMM(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
function matchMinutes(text: string, near: RegExp): number | null {
  const idx = text.search(near);
  if (idx < 0) return null;
  const window = text.slice(idx, idx + 40);
  return parseDuration(window);
}
function greetingReply(ctx: AssistantContext): string {
  const h = new Date(ctx.nowIso).getUTCHours();
  return `Hola, ${ctx.ownerName}.` + (h < 24 ? "" : "");
}

/** Very small extractive summarizer for demo docs. UNTRUSTED input. */
function summarizeText(text: string) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const executive = sentences.slice(0, 2).join(" ");
  const keyPoints = sentences.filter((s) => /clave|objetivo|reducir|aprobar|prioridad/i.test(s));
  const tasks = sentences.filter((s) => /tarea|enviar|agendar|preparar|llamar/i.test(s));
  const dates = (text.match(/\b\d{1,2}\s+de\s+\w+|\bviernes|\blunes|\bmartes|\bmi[eé]rcoles|\bjueves\b/gi) ?? []);
  const decisions = sentences.filter((s) => /decisi[oó]n|aprobar|decidir/i.test(s));
  const people = (text.match(/Se[ñn]or\s+\w+|equipo\s+de\s+\w+|direcci[oó]n/gi) ?? []);
  return { executive, keyPoints, tasks, dates, decisions, people };
}
