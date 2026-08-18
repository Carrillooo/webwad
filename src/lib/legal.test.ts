import { describe, it, expect, vi, afterEach } from "vitest";

async function conEntorno(env: Record<string, string>) {
  vi.resetModules();
  const previo = { ...process.env };
  for (const k of Object.keys(process.env)) if (k.startsWith("LEGAL_")) delete process.env[k];
  Object.assign(process.env, env);
  const mod = await import("./legal");
  const out = { titular: mod.titular(), falta: mod.faltaEnAvisoLegal(), completo: mod.avisoLegalCompleto() };
  process.env = previo;
  return out;
}

describe("identificación del titular (LSSI art. 10)", () => {
  afterEach(() => vi.resetModules());

  it("avisa de lo que falta en vez de inventárselo", async () => {
    const { falta, completo, titular } = await conEntorno({});
    expect(completo).toBe(false);
    expect(falta.join(" ")).toContain("LEGAL_NOMBRE");
    expect(falta.join(" ")).toContain("LEGAL_NIF");
    expect(falta.join(" ")).toContain("LEGAL_DOMICILIO");
    // Nada de rellenar huecos con datos falsos.
    expect(titular.nombre).toBe("");
    expect(titular.nif).toBe("");
  });

  it("da el aviso por completo cuando están los tres datos obligatorios", async () => {
    const { completo, falta } = await conEntorno({
      LEGAL_NOMBRE: "Adrián Carrillo",
      LEGAL_NIF: "00000000X",
      LEGAL_DOMICILIO: "Calle de ejemplo 1, Madrid",
    });
    expect(completo).toBe(true);
    expect(falta).toEqual([]);
  });

  it("el teléfono y el registro son opcionales", async () => {
    const { completo } = await conEntorno({
      LEGAL_NOMBRE: "Ejemplo S.L.",
      LEGAL_NIF: "B00000000",
      LEGAL_DOMICILIO: "Calle de ejemplo 1",
    });
    expect(completo).toBe(true);
  });

  it("los espacios sueltos no cuentan como dato relleno", async () => {
    const { completo } = await conEntorno({ LEGAL_NOMBRE: "   ", LEGAL_NIF: "  ", LEGAL_DOMICILIO: " " });
    expect(completo).toBe(false);
  });

  it("la marca por defecto es ZERO y el correo cae en el de contacto", async () => {
    const { titular } = await conEntorno({ LEGAL_EMAIL: "hola@ejemplo.com" });
    expect(titular.marca).toBe("ZERO");
    expect(titular.email).toBe("hola@ejemplo.com");
  });
});
