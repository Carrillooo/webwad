import { describe, it, expect, vi, beforeEach } from "vitest";

type MailOpts = { from: string; to: string; subject: string; text: string };
const sendMailMock = vi.fn(async (_opts: MailOpts) => ({ accepted: [] as string[], messageId: "" }));
const createTransportMock = vi.fn((_cfg: { port: number; secure: boolean }) => ({
  sendMail: sendMailMock,
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}));

// Toggled per test so we can exercise both the configured and unconfigured paths.
const smtp = { host: "", port: 587, user: "", pass: "", from: "zero@ejemplo.com" };
vi.mock("@/lib/config", async () => {
  const actual = await vi.importActual<typeof import("./../config")>("./../config");
  return {
    ...actual,
    serverConfig: { ...actual.serverConfig, get smtp() { return smtp; } },
    isSmtpConfigured: () => smtp.host !== "" && smtp.user !== "" && smtp.pass !== "",
  };
});

const { sendMail } = await import("./send");

beforeEach(() => {
  sendMailMock.mockReset();
  createTransportMock.mockClear();
  Object.assign(smtp, { host: "", port: 587, user: "", pass: "", from: "zero@ejemplo.com" });
});

describe("sendMail", () => {
  it("refuses (never fakes success) when SMTP is not configured", async () => {
    const r = await sendMail({ to: "a@b.com", subject: "Hola", body: "Texto" });
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("SMTP_HOST");
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it("sends from the configured address and reports the real result", async () => {
    Object.assign(smtp, { host: "smtp.test", port: 587, user: "u", pass: "p" });
    sendMailMock.mockResolvedValue({ accepted: ["a@b.com"], messageId: "<id-1>" });

    const r = await sendMail({ to: "a@b.com", subject: "Presupuesto", body: "Adjunto." });
    expect(r.ok).toBe(true);
    expect(r.detail).toContain("a@b.com");

    const opts = sendMailMock.mock.calls[0][0];
    expect(opts.from).toContain("zero@ejemplo.com");
    expect(opts.to).toBe("a@b.com");
    expect(opts.subject).toBe("Presupuesto");
  });

  it("shows the account's name as sender and falls back to SMTP_USER without MAIL_FROM", async () => {
    Object.assign(smtp, { host: "smtp.test", port: 587, user: "cuenta@correo.com", pass: "p", from: "" });
    sendMailMock.mockResolvedValue({ accepted: ["a@b.com"], messageId: "<id-2>" });

    await sendMail({ to: "a@b.com", subject: "s", body: "b", senderName: 'Adri "El Jefe"' });
    const opts = sendMailMock.mock.calls[0][0];
    // Comillas fuera (romperían la cabecera), nombre dentro, remitente = SMTP_USER.
    expect(opts.from).toBe('"Adri El Jefe" <cuenta@correo.com>');
  });

  it("uses implicit TLS on port 465", async () => {
    Object.assign(smtp, { host: "smtp.test", port: 465, user: "u", pass: "p" });
    sendMailMock.mockResolvedValue({ accepted: ["a@b.com"], messageId: "<id>" });
    await sendMail({ to: "a@b.com", subject: "s", body: "b" });
    expect(createTransportMock.mock.calls[0][0]).toMatchObject({ port: 465, secure: true });
  });

  it("reports failure when no recipient was accepted", async () => {
    Object.assign(smtp, { host: "smtp.test", port: 587, user: "u", pass: "p" });
    sendMailMock.mockResolvedValue({ accepted: [], messageId: "<id>" });
    const r = await sendMail({ to: "a@b.com", subject: "s", body: "b" });
    expect(r.ok).toBe(false);
  });

  it("turns SMTP exceptions into a failed receipt instead of throwing", async () => {
    Object.assign(smtp, { host: "smtp.test", port: 587, user: "u", pass: "p" });
    sendMailMock.mockRejectedValue(new Error("535 auth failed"));
    const r = await sendMail({ to: "a@b.com", subject: "s", body: "b" });
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("535 auth failed");
  });
});
