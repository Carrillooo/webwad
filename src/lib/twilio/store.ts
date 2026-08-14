import { randomUUID } from "node:crypto";
import { database, isDatabaseConfigured } from "../db/server";

/**
 * Registro de llamadas telefónicas de ZERO (Twilio). El webhook de voz es
 * sin estado entre turnos, así que la conversación vive aquí, por llamada.
 * Con base de datos persiste; sin ella (desarrollo) va en memoria.
 */

export type CallStatus =
  | "iniciando"
  | "sonando"
  | "en_curso"
  | "completada"
  | "sin_respuesta"
  | "ocupado"
  | "fallida";

export interface CallTurn {
  /** "zero" = lo que dijo el asistente; "persona" = lo que contestó. */
  who: "zero" | "persona";
  text: string;
}

export interface PhoneCall {
  id: string;
  userId: string;
  callSid: string | null;
  toNumber: string;
  contactName: string | null;
  goal: string;
  status: CallStatus;
  result: string | null;
  turns: CallTurn[];
  durationS: number | null;
  createdAt: string;
}

const g = globalThis as unknown as { __zeroCalls?: Map<string, PhoneCall> };
function mem() {
  if (!g.__zeroCalls) g.__zeroCalls = new Map();
  return g.__zeroCalls;
}

function rowToCall(r: Record<string, unknown>): PhoneCall {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    callSid: r.call_sid ? String(r.call_sid) : null,
    toNumber: String(r.to_number),
    contactName: r.contact_name ? String(r.contact_name) : null,
    goal: String(r.goal),
    status: String(r.status) as CallStatus,
    result: r.result ? String(r.result) : null,
    turns: Array.isArray(r.turns) ? (r.turns as CallTurn[]) : [],
    durationS: r.duration_s == null ? null : Number(r.duration_s),
    createdAt: new Date(r.created_at as string | Date).toISOString(),
  };
}

export async function createCall(
  userId: string,
  input: { toNumber: string; contactName?: string; goal: string },
): Promise<PhoneCall> {
  const call: PhoneCall = {
    id: randomUUID(),
    userId,
    callSid: null,
    toNumber: input.toNumber,
    contactName: input.contactName ?? null,
    goal: input.goal,
    status: "iniciando",
    result: null,
    turns: [],
    durationS: null,
    createdAt: new Date().toISOString(),
  };
  if (isDatabaseConfigured()) {
    const sql = await database();
    await sql`
      insert into phone_calls (id, user_id, to_number, contact_name, goal, status, turns)
      values (${call.id}, ${userId}, ${call.toNumber}, ${call.contactName}, ${call.goal}, ${call.status}, ${JSON.stringify(call.turns)})
    `;
  } else {
    mem().set(call.id, call);
  }
  return call;
}

export async function getCall(id: string): Promise<PhoneCall | null> {
  if (isDatabaseConfigured()) {
    const sql = await database();
    const rows = await sql`select * from phone_calls where id = ${id} limit 1`;
    return rows[0] ? rowToCall(rows[0] as Record<string, unknown>) : null;
  }
  return mem().get(id) ?? null;
}

export async function updateCall(
  id: string,
  patch: Partial<Pick<PhoneCall, "callSid" | "status" | "result" | "turns" | "durationS">>,
): Promise<void> {
  if (isDatabaseConfigured()) {
    const sql = await database();
    // Cada campo por separado: coalesce mantiene lo que no venga en el parche.
    await sql`
      update phone_calls set
        call_sid = coalesce(${patch.callSid ?? null}, call_sid),
        status = coalesce(${patch.status ?? null}, status),
        result = coalesce(${patch.result ?? null}, result),
        turns = coalesce(${patch.turns ? JSON.stringify(patch.turns) : null}::jsonb, turns),
        duration_s = coalesce(${patch.durationS ?? null}, duration_s)
      where id = ${id}
    `;
    return;
  }
  const c = mem().get(id);
  if (!c) return;
  Object.assign(c, {
    ...(patch.callSid !== undefined ? { callSid: patch.callSid } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.result !== undefined ? { result: patch.result } : {}),
    ...(patch.turns !== undefined ? { turns: patch.turns } : {}),
    ...(patch.durationS !== undefined ? { durationS: patch.durationS } : {}),
  });
}

/** Últimas llamadas del usuario, la más reciente primero. */
export async function listCalls(userId: string, limit = 5): Promise<PhoneCall[]> {
  if (isDatabaseConfigured()) {
    const sql = await database();
    const rows = await sql`
      select * from phone_calls where user_id = ${userId}
      order by created_at desc limit ${limit}
    `;
    return (rows as unknown as Record<string, unknown>[]).map(rowToCall);
  }
  return [...mem().values()]
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
