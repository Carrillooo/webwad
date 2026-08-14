import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createVerification, verifyCode } from "./verification";

/** Códigos de verificación del registro (camino en memoria). */

const g = globalThis as unknown as { __zeroEmailCodes?: Map<string, unknown> };

beforeEach(() => {
  g.__zeroEmailCodes = undefined;
});
afterEach(() => vi.useRealTimers());

describe("códigos de verificación", () => {
  it("genera 6 dígitos y verifica una sola vez (se consume)", async () => {
    const code = await createVerification("Adri@x.com");
    expect(code).toMatch(/^\d{6}$/);
    // El email se normaliza: mayúsculas dan igual.
    expect(await verifyCode("adri@X.com", code)).toBe("ok");
    expect(await verifyCode("adri@x.com", code)).toBe("codigo_caducado"); // ya consumido
  });

  it("un código equivocado no pasa y al 5º intento se invalida", async () => {
    const code = await createVerification("a@x.com");
    for (let i = 0; i < 5; i++) {
      expect(await verifyCode("a@x.com", "000000")).toBe("codigo_incorrecto");
    }
    // Agotados los intentos, ni siquiera el bueno vale: hay que pedir otro.
    expect(await verifyCode("a@x.com", code)).toBe("codigo_caducado");
  });

  it("caduca a los 10 minutos", async () => {
    vi.useFakeTimers();
    const code = await createVerification("a@x.com");
    vi.advanceTimersByTime(11 * 60_000);
    expect(await verifyCode("a@x.com", code)).toBe("codigo_caducado");
  });

  it("pedir un código nuevo sustituye al anterior", async () => {
    const primero = await createVerification("a@x.com");
    const segundo = await createVerification("a@x.com");
    if (primero !== segundo) {
      expect(await verifyCode("a@x.com", primero)).toBe("codigo_incorrecto");
    }
    expect(await verifyCode("a@x.com", segundo)).toBe("ok");
  });
});
