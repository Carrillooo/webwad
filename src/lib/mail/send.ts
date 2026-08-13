import nodemailer from "nodemailer";
import { serverConfig, isSmtpConfigured } from "@/lib/config";

export interface MailInput {
  to: string;
  subject: string;
  body: string;
}

export interface MailResult {
  ok: boolean;
  detail: string;
}

/**
 * Sends a plain-text email through the configured SMTP account
 * (daniel@rolmovil.com). Never fakes success: the receipt is only positive
 * when the SMTP server accepted the message.
 */
export async function sendMail(input: MailInput): Promise<MailResult> {
  if (!isSmtpConfigured()) {
    return {
      ok: false,
      detail:
        "El correo no está configurado todavía (faltan SMTP_HOST/SMTP_USER/SMTP_PASS en .env.local).",
    };
  }
  const { host, port, user, pass, from } = serverConfig.smtp;
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 10_000,
      socketTimeout: 20_000,
    });
    const info = await transporter.sendMail({
      from: `"Daniel (ZERO)" <${from}>`,
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
    const accepted = (info.accepted ?? []).length > 0;
    return accepted
      ? { ok: true, detail: `Enviado a ${input.to} (id ${info.messageId}).` }
      : { ok: false, detail: "El servidor SMTP no aceptó ningún destinatario." };
  } catch (err) {
    return {
      ok: false,
      detail: `Fallo SMTP: ${err instanceof Error ? err.message : "error desconocido"}`,
    };
  }
}
