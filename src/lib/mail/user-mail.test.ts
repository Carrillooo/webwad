import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildGmailRaw, sendMailForUser, mailSenderFor } from "./user-mail";

/**
 * El correo por usuario: Gmail conectado → Outlook conectado → SMTP → fallo
 * honesto. Camino en memoria (sin DATABASE_URL) con fetch simulado.
 */

const g = globalThis as unknown as {
  __novaGoogle?: Map<string, unknown>;
  __novaMicrosoft?: Map<string, unknown>;
};

beforeEach(() => {
  g.__novaGoogle = undefined;
  g.__novaMicrosoft = undefined;
});
afterEach(() => vi.unstubAllGlobals());

const INPUT = { to: "cliente@acme.com", subject: "Presupuesto", body: "Hola, adjunto va." };

function decodeRaw(raw: string): string {
  return Buffer.from(raw, "base64url").toString("utf8");
}

describe("buildGmailRaw", () => {
  it("monta un RFC 822 correcto con remitente, asunto UTF-8 y cuerpo en base64", () => {
    const mime = decodeRaw(
      buildGmailRaw({ ...INPUT, subject: "Presupuesto según lo hablado", senderName: "Adrián" }, "adri@gmail.com"),
    );
    expect(mime).toContain('From: "Adrián" <adri@gmail.com>');
    expect(mime).toContain("To: cliente@acme.com");
    expect(mime).toContain("Subject: =?UTF-8?B?");
    expect(mime).toContain(Buffer.from(INPUT.body, "utf8").toString("base64"));
  });

  it("asunto ASCII va sin codificar y sin From si no se conoce la dirección", () => {
    const mime = decodeRaw(buildGmailRaw(INPUT));
    expect(mime).toContain("Subject: Presupuesto");
    expect(mime).not.toContain("From:");
  });
});

describe("sendMailForUser", () => {
  it("sin Gmail ni Outlook enlazado NO se envía nada (ni siquiera con SMTP del servicio)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await sendMailForUser("u1", false, INPUT);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("Conecta tu Google o tu Outlook");
    expect(r.via).toBeUndefined(); // jamás cae al buzón compartido de la plataforma
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await mailSenderFor("u1", false)).toBeNull();
  });

  it("con Google conectado envía por la API de Gmail desde el email del usuario", async () => {
    const { saveConnection } = await import("../google/connection");
    await saveConnection(
      "u1",
      false,
      { accessToken: "tok", refreshToken: "1//r", expiresAt: Date.now() + 3600_000 },
      "adri@gmail.com",
    );
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toContain("gmail.googleapis.com");
      return new Response(JSON.stringify({ id: "msg-1" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const sender = await mailSenderFor("u1", false);
    expect(sender).toMatchObject({ via: "gmail", address: "adri@gmail.com" });

    const r = await sendMailForUser("u1", false, { ...INPUT, senderName: "Adrián" });
    expect(r).toMatchObject({ ok: true, via: "gmail" });
    expect(r.detail).toContain("adri@gmail.com");
  });

  it("si Gmail responde 403 (falta gmail.send) lo dice claro y NO finge éxito", async () => {
    const { saveConnection } = await import("../google/connection");
    await saveConnection("u1", false, { accessToken: "tok", refreshToken: "1//r", expiresAt: Date.now() + 3600_000 });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("insufficient scope", { status: 403 })));
    const r = await sendMailForUser("u1", false, INPUT);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("vuelve a conectar Google");
  });

  it("sin Google pero con Outlook conectado envía por Graph sendMail", async () => {
    const { saveMsConnection } = await import("../microsoft/connection");
    await saveMsConnection(
      "u1",
      false,
      { accessToken: "mtok", refreshToken: "mref", expiresAt: Date.now() + 3600_000 },
      "adri@outlook.com",
    );
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toContain("graph.microsoft.com/v1.0/me/sendMail");
      const body = JSON.parse(String(init?.body));
      expect(body.message.toRecipients[0].emailAddress.address).toBe(INPUT.to);
      return new Response(null, { status: 202 });
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await mailSenderFor("u1", false)).toMatchObject({ via: "outlook", address: "adri@outlook.com" });
    const r = await sendMailForUser("u1", false, INPUT);
    expect(r).toMatchObject({ ok: true, via: "outlook" });
  });

  it("aísla por usuario: la conexión de u1 no envía los correos de u2", async () => {
    const { saveConnection } = await import("../google/connection");
    await saveConnection("u1", false, { accessToken: "tok", refreshToken: "1//r", expiresAt: Date.now() + 3600_000 });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await sendMailForUser("u2", false, INPUT);
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
