import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./anthropic";

const ctx = {
  ownerName: "Daniel",
  nowIso: "2026-08-14T00:05:00+02:00",
  timezone: "Europe/Madrid",
  demoMode: false,
};

describe("aviso de modo demo en el prompt", () => {
  it("en modo demo obliga a avisar de que no es real", () => {
    const p = buildSystemPrompt({ ...ctx, demoMode: true }, []).volatile;
    expect(p).toContain("MODO DEMO");
    expect(p).toMatch(/no ha llegado a tu Google/i);
  });

  it("conectado de verdad no mete ningún aviso", () => {
    const p = buildSystemPrompt(ctx, []).volatile;
    expect(p).not.toContain("MODO DEMO");
  });

  it("la parte cacheada no cambia entre peticiones (si no, no cachea)", () => {
    const a = buildSystemPrompt(ctx, []).stable;
    const b = buildSystemPrompt({ ...ctx, nowIso: "2026-12-25T10:00:00+01:00" }, []).stable;
    expect(a).toBe(b);
  });

  it("la hora y la memoria van en la parte volátil, nunca en la cacheada", () => {
    const { stable, volatile } = buildSystemPrompt(ctx, [
      { id: "m1", kind: "fact", value: "El almacén está en Zarzaquemada", createdAt: ctx.nowIso },
    ]);
    expect(volatile).toContain("Zarzaquemada");
    expect(volatile).toMatch(/AHORA MISMO en Madrid/);
    expect(stable).not.toContain("Zarzaquemada");
    expect(stable).not.toMatch(/AHORA MISMO en Madrid/);
  });
});
