import { randomUUID } from "node:crypto";
import { database, isDatabaseConfigured } from "../db/server";

/**
 * Historial de conversaciones. Las tablas ya existían en el esquema pero no
 * se usaban: al recargar se perdía todo lo hablado. Ahora cada turno queda
 * guardado y se puede repasar "qué le pedí el martes".
 *
 * Una conversación agrupa los turnos seguidos: si el último mensaje es de
 * hace menos de 2 horas se continúa, si no se abre una nueva.
 */

const CONTINUE_WINDOW_MS = 2 * 60 * 60_000;
const MAX_SESSIONS = 20;
const MAX_MESSAGES_PER_SESSION = 40;

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  at: string;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: StoredMessage[];
}

const g = globalThis as unknown as {
  __zeroConvos?: Map<string, Conversation & { userId: string }>;
};
function mem() {
  if (!g.__zeroConvos) g.__zeroConvos = new Map();
  return g.__zeroConvos;
}

function titleFrom(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return (clean.length > 60 ? `${clean.slice(0, 57)}…` : clean) || "Conversación";
}

/**
 * Guarda un turno completo (lo que dijo el usuario y lo que respondió ZERO).
 * Nunca lanza: el historial no puede tumbar una respuesta del asistente.
 */
export async function saveTurn(userId: string, userText: string, replyText: string): Promise<void> {
  const now = new Date();
  const user = userText.trim().slice(0, 2000);
  const reply = replyText.trim().slice(0, 4000);
  if (!user && !reply) return;

  try {
    if (isDatabaseConfigured()) {
      const sql = await database();
      const recent = await sql`
        select id from assistant_sessions
        where user_id = ${userId} and updated_at > ${new Date(now.getTime() - CONTINUE_WINDOW_MS)}
        order by updated_at desc limit 1
      `;
      let sessionId = recent[0] ? String((recent[0] as { id: string }).id) : "";
      if (!sessionId) {
        const created = await sql`
          insert into assistant_sessions (user_id, title) values (${userId}, ${titleFrom(user)})
          returning id
        `;
        sessionId = String((created[0] as { id: string }).id);
      } else {
        await sql`update assistant_sessions set updated_at = now() where id = ${sessionId}`;
      }
      if (user) {
        await sql`
          insert into assistant_messages (session_id, user_id, role, content)
          values (${sessionId}, ${userId}, 'user', ${user})
        `;
      }
      if (reply) {
        await sql`
          insert into assistant_messages (session_id, user_id, role, content)
          values (${sessionId}, ${userId}, 'assistant', ${reply})
        `;
      }
      return;
    }

    // Camino en memoria (desarrollo sin base de datos).
    const mine = [...mem().values()]
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    let convo = mine[0];
    if (!convo || now.getTime() - new Date(convo.updatedAt).getTime() > CONTINUE_WINDOW_MS) {
      convo = { id: randomUUID(), userId, title: titleFrom(user), updatedAt: now.toISOString(), messages: [] };
      mem().set(convo.id, convo);
    }
    if (user) convo.messages.push({ role: "user", content: user, at: now.toISOString() });
    if (reply) convo.messages.push({ role: "assistant", content: reply, at: now.toISOString() });
    convo.messages = convo.messages.slice(-MAX_MESSAGES_PER_SESSION);
    convo.updatedAt = now.toISOString();
  } catch (e) {
    console.error("no se pudo guardar el turno en el historial", e);
  }
}

/** Conversaciones del usuario, la más reciente primero. */
export async function listConversations(userId: string, limit = MAX_SESSIONS): Promise<Conversation[]> {
  if (isDatabaseConfigured()) {
    const sql = await database();
    const sessions = await sql`
      select id, title, updated_at from assistant_sessions
      where user_id = ${userId} order by updated_at desc limit ${limit}
    `;
    const rows = sessions as unknown as { id: string; title: string | null; updated_at: string | Date }[];
    if (!rows.length) return [];
    const ids = rows.map((r) => String(r.id));
    const msgs = await sql`
      select session_id, role, content, created_at from assistant_messages
      where session_id = any(${ids}) order by created_at asc
    `;
    const bySession = new Map<string, StoredMessage[]>();
    for (const m of msgs as unknown as {
      session_id: string;
      role: string;
      content: string;
      created_at: string | Date;
    }[]) {
      const list = bySession.get(String(m.session_id)) ?? [];
      list.push({
        role: m.role === "user" ? "user" : "assistant",
        content: String(m.content),
        at: new Date(m.created_at).toISOString(),
      });
      bySession.set(String(m.session_id), list);
    }
    return rows.map((r) => ({
      id: String(r.id),
      title: r.title ?? "Conversación",
      updatedAt: new Date(r.updated_at).toISOString(),
      messages: (bySession.get(String(r.id)) ?? []).slice(-MAX_MESSAGES_PER_SESSION),
    }));
  }

  return [...mem().values()]
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
    .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, messages: c.messages }));
}

/** Borra TODO el historial del usuario (botón en la vista de historial). */
export async function clearConversations(userId: string): Promise<void> {
  if (isDatabaseConfigured()) {
    const sql = await database();
    await sql`delete from assistant_sessions where user_id = ${userId}`;
    return;
  }
  for (const [id, c] of mem()) if (c.userId === userId) mem().delete(id);
}
