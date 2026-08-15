import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { saveTurn, listConversations, clearConversations } from "./store";

/** Historial de conversaciones (camino en memoria: sin DATABASE_URL en tests). */

const g = globalThis as unknown as { __zeroConvos?: Map<string, unknown> };

beforeEach(() => {
  g.__zeroConvos = undefined;
});
afterEach(() => vi.useRealTimers());

describe("historial de conversaciones", () => {
  it("guarda el turno completo y lo devuelve en orden", async () => {
    await saveTurn("u1", "¿Qué tengo hoy?", "Tienes dos cosas: reunión y gimnasio.");
    const [c] = await listConversations("u1");
    expect(c.messages).toEqual([
      expect.objectContaining({ role: "user", content: "¿Qué tengo hoy?" }),
      expect.objectContaining({ role: "assistant", content: "Tienes dos cosas: reunión y gimnasio." }),
    ]);
    // El título resume la conversación con lo primero que se pidió.
    expect(c.title).toBe("¿Qué tengo hoy?");
  });

  it("los turnos seguidos se agrupan en la misma conversación", async () => {
    await saveTurn("u1", "Hola", "Hola, ¿en qué te ayudo?");
    await saveTurn("u1", "Añade una tarea", "Hecho.");
    const convos = await listConversations("u1");
    expect(convos).toHaveLength(1);
    expect(convos[0].messages).toHaveLength(4);
  });

  it("tras un buen rato se abre una conversación nueva", async () => {
    vi.useFakeTimers();
    await saveTurn("u1", "Primero", "Vale.");
    vi.advanceTimersByTime(3 * 60 * 60_000); // 3 h después
    await saveTurn("u1", "Segundo", "Vale.");
    const convos = await listConversations("u1");
    expect(convos).toHaveLength(2);
    expect(convos[0].title).toBe("Segundo"); // la más reciente primero
  });

  it("cada usuario ve SOLO su historial", async () => {
    await saveTurn("u1", "Lo mío", "Vale.");
    await saveTurn("u2", "Lo suyo", "Vale.");
    expect(await listConversations("u1")).toHaveLength(1);
    expect((await listConversations("u2"))[0].title).toBe("Lo suyo");
  });

  it("borrar el historial solo afecta a quien lo pide", async () => {
    await saveTurn("u1", "Mío", "Vale.");
    await saveTurn("u2", "Suyo", "Vale.");
    await clearConversations("u1");
    expect(await listConversations("u1")).toHaveLength(0);
    expect(await listConversations("u2")).toHaveLength(1);
  });

  it("un turno vacío no ensucia el historial", async () => {
    await saveTurn("u1", "   ", "");
    expect(await listConversations("u1")).toHaveLength(0);
  });
});
