import { describe, it, expect } from "vitest";
import { wantsAnswer } from "./useAssistant";

describe("wantsAnswer (conversación seguida)", () => {
  it("reabre el micro cuando ZERO termina preguntando", () => {
    expect(wantsAnswer("¿Cómo lo llamo?", false)).toBe(true);
    expect(wantsAnswer("Vale. ¿Lo pongo el viernes o el sábado?", false)).toBe(true);
    // Comillas de cierre tras la interrogación (el TTS las limpia, el texto no).
    expect(wantsAnswer('¿Le llamo "Gimnasio"?"', false)).toBe(true);
    expect(wantsAnswer("¿A qué hora?»", false)).toBe(true);
  });

  it("no reabre el micro tras una confirmación", () => {
    expect(wantsAnswer("Hecho: Gimnasio mañana a las 13:00.", false)).toBe(false);
    expect(wantsAnswer("He borrado los 3 eventos.", false)).toBe(false);
    // Una interrogación en medio no cuenta: lo que importa es cómo acaba.
    expect(wantsAnswer("¿El gimnasio? Ya lo tienes a las 13:00.", false)).toBe(false);
  });

  it("reabre el micro si hay una propuesta pendiente de confirmar", () => {
    expect(wantsAnswer("Voy a borrar 12 tareas.", true)).toBe(true);
  });

  it("no se rompe con respuestas vacías", () => {
    expect(wantsAnswer("", false)).toBe(false);
    expect(wantsAnswer("   ", false)).toBe(false);
  });
});
