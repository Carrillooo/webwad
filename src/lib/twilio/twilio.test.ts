import { describe, it, expect, beforeEach } from "vitest";
import { twilioSignature, validTwilioSignature } from "./signature";
import { speakAndListen, speakAndHangup, xmlEscape } from "./twiml";
import { isValidPhone } from "./api";
import { createCall, getCall, updateCall, listCalls } from "./store";

const g = globalThis as unknown as { __zeroCalls?: Map<string, unknown> };
beforeEach(() => {
  g.__zeroCalls = undefined;
});

describe("firma de webhooks de Twilio", () => {
  const url = "https://zero.app/api/twilio/voice?cid=abc";
  const params = { CallSid: "CA123", SpeechResult: "hola" };

  it("acepta la firma correcta y rechaza cualquier otra", () => {
    const good = twilioSignature(url, params, "token-secreto");
    expect(validTwilioSignature(good, url, params, "token-secreto")).toBe(true);
    expect(validTwilioSignature(good, url, { ...params, SpeechResult: "adiós" }, "token-secreto")).toBe(false);
    expect(validTwilioSignature(good, url + "&x=1", params, "token-secreto")).toBe(false);
    expect(validTwilioSignature("AAAA", url, params, "token-secreto")).toBe(false);
    expect(validTwilioSignature(null, url, params, "token-secreto")).toBe(false);
  });

  it("los parámetros se ordenan alfabéticamente (esquema oficial)", () => {
    // Mismo contenido en distinto orden de inserción → misma firma.
    const a = twilioSignature(url, { B: "2", A: "1" }, "t");
    const b = twilioSignature(url, { A: "1", B: "2" }, "t");
    expect(a).toBe(b);
  });
});

describe("TwiML", () => {
  it("escapa XML: nada de romper el documento con comillas o <", () => {
    expect(xmlEscape(`di "hola" & <adiós>`)).toBe("di &quot;hola&quot; &amp; &lt;adiós&gt;");
  });

  it("speakAndListen: Gather de voz es-ES con la frase dentro y fallback con Hangup", () => {
    const xml = speakAndListen("¿Le viene bien el viernes?", "https://x/api/twilio/voice?cid=1");
    expect(xml).toContain('<Gather input="speech" language="es-ES"');
    expect(xml).toContain("¿Le viene bien el viernes?");
    expect(xml).toContain('action="https://x/api/twilio/voice?cid=1"');
    expect(xml).toContain("<Hangup/>");
  });

  it("speakAndHangup: despedida y colgar", () => {
    const xml = speakAndHangup("Gracias, adiós.");
    expect(xml).toContain("Gracias, adiós.");
    expect(xml).toContain("<Hangup/>");
    expect(xml).not.toContain("<Gather");
  });
});

describe("validación de teléfono (E.164)", () => {
  it("acepta internacionales y rechaza locales o con letras", () => {
    expect(isValidPhone("+34600112233")).toBe(true);
    expect(isValidPhone("+12025550123")).toBe(true);
    expect(isValidPhone("600112233")).toBe(false);
    expect(isValidPhone("+34 600 11 22 33")).toBe(false); // espacios: se limpian antes
    expect(isValidPhone("+0034600112233")).toBe(false);
    expect(isValidPhone("llamar a mamá")).toBe(false);
  });
});

describe("registro de llamadas (memoria)", () => {
  it("crea, actualiza por parches y lista solo lo del usuario", async () => {
    const c = await createCall("u1", { toNumber: "+34600112233", contactName: "Peluquería", goal: "Pedir cita" });
    await createCall("u2", { toNumber: "+34911223344", goal: "Otra cosa" });

    await updateCall(c.id, { status: "en_curso", turns: [{ who: "zero", text: "Hola" }] });
    await updateCall(c.id, { status: "completada", result: "Cita el viernes 17:00" });

    const stored = await getCall(c.id);
    expect(stored?.status).toBe("completada");
    expect(stored?.result).toBe("Cita el viernes 17:00");
    expect(stored?.turns).toHaveLength(1); // el parche sin turns no los pisa

    const deU1 = await listCalls("u1");
    expect(deU1).toHaveLength(1);
    expect(deU1[0].contactName).toBe("Peluquería");
  });
});
