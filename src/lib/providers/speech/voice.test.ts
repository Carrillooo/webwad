import { describe, it, expect } from "vitest";
import { scoreVoice, pickVoice } from "./browser";

const v = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;

/** Voces reales que trae macOS en español (las que le salían a Daniel). */
const MAC = [
  v("Mónica", "es-ES"),
  v("Paulina", "es-MX"),
  v("Jorge", "es-ES"),
  v("Diego", "es-AR"),
  v("Juan", "es-MX"),
];

/** Windows/Edge: voces neuronales online. */
const EDGE = [
  v("Microsoft Elvira Online (Natural) - Spanish (Spain)", "es-ES"),
  v("Microsoft Alvaro Online (Natural) - Spanish (Spain)", "es-ES"),
  v("Microsoft Dalia Online (Natural) - Spanish (Mexico)", "es-MX"),
];

describe("elección de voz del navegador", () => {
  it("en un Mac elige a Jorge (hombre, España), no a Paulina", () => {
    expect(pickVoice(MAC)?.name).toBe("Jorge");
  });

  it("en Edge elige a Álvaro (hombre) antes que a Elvira, aunque las dos sean neuronales", () => {
    expect(pickVoice(EDGE)?.name).toBe("Microsoft Alvaro Online (Natural) - Spanish (Spain)");
  });

  it("es-ES gana a es-MX aunque la mexicana sea de hombre", () => {
    expect(pickVoice([v("Juan", "es-MX"), v("Jorge", "es-ES")])?.name).toBe("Jorge");
  });

  it("descarta voces que no sean español", () => {
    expect(scoreVoice(v("Daniel", "en-GB"))).toBe(-1);
    expect(pickVoice([v("Daniel", "en-GB"), v("Alex", "en-US")])).toBeUndefined();
  });

  it("es determinista: el mismo conjunto da siempre la misma voz", () => {
    const a = pickVoice(MAC)?.name;
    const b = pickVoice([...MAC].reverse())?.name;
    const c = pickVoice([...MAC].sort())?.name;
    expect(new Set([a, b, c]).size).toBe(1);
  });

  it("prefiere una voz normal antes que espeak", () => {
    expect(pickVoice([v("espeak-ng Spanish", "es-ES"), v("Jorge", "es-ES")])?.name).toBe("Jorge");
  });

  it("si solo hay voces de mujer, sigue hablando (no se queda muda)", () => {
    expect(pickVoice([v("Mónica", "es-ES")])?.name).toBe("Mónica");
  });
});
