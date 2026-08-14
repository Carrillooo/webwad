import { getAccessToken, getConnection } from "../google/connection";
import { getMsAccessToken, getMsConnection } from "../microsoft/connection";
import { isSmtpConfigured, serverConfig } from "../config";
import { sendMail, type MailResult } from "./send";

/**
 * Correo saliente EN NOMBRE del usuario: cada cuenta envía desde SU buzón.
 *
 * Orden: Gmail conectado → Outlook conectado → SMTP del servicio (si existe)
 * → fallo honesto. Así el remitente es el correo real de quien usa ZERO y no
 * un buzón compartido de la plataforma.
 */

export interface UserMailInput {
  to: string;
  subject: string;
  body: string;
  /** Nombre a mostrar como remitente. */
  senderName?: string;
}

export interface UserMailResult extends MailResult {
  via?: "gmail" | "outlook" | "smtp";
}

export interface MailSender {
  via: "gmail" | "outlook" | "smtp";
  /** Dirección desde la que saldrá el correo (si se conoce). */
  address: string;
}

/** Desde dónde saldría un correo de este usuario ahora mismo (para el prompt). */
export async function mailSenderFor(userId: string, authed: boolean): Promise<MailSender | null> {
  try {
    const google = await getConnection(userId, authed);
    if (google.connected) return { via: "gmail", address: google.email ?? "tu Gmail" };
  } catch {
    /* seguir con el resto */
  }
  try {
    const ms = await getMsConnection(userId, authed);
    if (ms.connected) return { via: "outlook", address: ms.email ?? "tu Outlook" };
  } catch {
    /* seguir con el resto */
  }
  if (isSmtpConfigured()) {
    return { via: "smtp", address: serverConfig.smtp.from || serverConfig.smtp.user };
  }
  return null;
}

/** RFC 2047 para asuntos con acentos/emoji. */
function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function cleanName(name?: string): string {
  return (name ?? "").replace(/["\r\n]/g, "").trim();
}

/** Mensaje RFC 822 para Gmail (texto plano UTF-8). */
export function buildGmailRaw(input: UserMailInput, fromAddress?: string): string {
  const name = cleanName(input.senderName);
  const lines = [
    ...(fromAddress ? [`From: ${name ? `"${name}" ` : ""}<${fromAddress}>`] : []),
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(input.body, "utf8").toString("base64"),
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

async function sendViaGmail(
  token: string,
  input: UserMailInput,
  fromAddress?: string,
): Promise<UserMailResult> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: buildGmailRaw(input, fromAddress) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.ok) {
    const j = (await res.json()) as { id?: string };
    return {
      ok: true,
      via: "gmail",
      detail: `Enviado a ${input.to} desde ${fromAddress ?? "tu Gmail"} (id ${j.id ?? "?"}).`,
    };
  }
  const text = (await res.text()).slice(0, 300);
  if (res.status === 403 || res.status === 401) {
    return {
      ok: false,
      via: "gmail",
      detail:
        "Tu Google está conectado pero sin permiso para enviar correo. Desconecta y vuelve a conectar Google en Ajustes para concederlo.",
    };
  }
  return { ok: false, via: "gmail", detail: `Gmail no aceptó el envío (${res.status}): ${text}` };
}

async function sendViaOutlook(token: string, input: UserMailInput): Promise<UserMailResult> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: { contentType: "Text", content: input.body },
        toRecipients: [{ emailAddress: { address: input.to } }],
      },
      saveToSentItems: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 202) {
    return { ok: true, via: "outlook", detail: `Enviado a ${input.to} desde tu Outlook.` };
  }
  const text = (await res.text()).slice(0, 300);
  if (res.status === 403 || res.status === 401) {
    return {
      ok: false,
      via: "outlook",
      detail:
        "Tu Outlook está conectado pero sin permiso para enviar correo (falta Mail.Send). Vuelve a conectar Outlook en Ajustes.",
    };
  }
  return { ok: false, via: "outlook", detail: `Outlook no aceptó el envío (${res.status}): ${text}` };
}

/**
 * Envía el correo desde la mejor cuenta disponible del usuario. Nunca finge:
 * el recibo solo es positivo si el proveedor aceptó el mensaje.
 */
export async function sendMailForUser(
  userId: string,
  authed: boolean,
  input: UserMailInput,
): Promise<UserMailResult> {
  // 1) Gmail del usuario.
  try {
    const token = await getAccessToken(userId, authed);
    if (token) {
      const conn = await getConnection(userId, authed).catch(() => ({ connected: false as const }));
      return await sendViaGmail(token, input, "email" in conn ? conn.email : undefined);
    }
  } catch (e) {
    console.error("gmail send error", e);
  }
  // 2) Outlook del usuario.
  try {
    const token = await getMsAccessToken(userId, authed);
    if (token) return await sendViaOutlook(token, input);
  } catch (e) {
    console.error("outlook send error", e);
  }
  // 3) SMTP del servicio (si el operador lo configuró).
  if (isSmtpConfigured()) {
    const r = await sendMail(input);
    return { ...r, via: "smtp" };
  }
  return {
    ok: false,
    detail:
      "No hay ninguna cuenta de correo enlazada. Conecta Google u Outlook en Ajustes y podré enviar desde tu propio email.",
  };
}
