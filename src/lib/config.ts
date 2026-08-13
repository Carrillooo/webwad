/**
 * Central runtime configuration + capability detection.
 *
 * DEMO_MODE is the master switch. When true (or when a required credential
 * is missing) ZERO falls back to mock providers so the whole app is usable
 * without any external service configured.
 */

function demoExplicitlyOn(): boolean {
  const raw = process.env.DEMO_MODE ?? process.env.NEXT_PUBLIC_DEMO_MODE;
  return raw === "true" || raw === "1";
}

/** Server-side view of the environment. Never expose secrets to the client. */
export const serverConfig = {
  demoMode: demoExplicitlyOn(),
  appUrl: process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

  /** PostgreSQL provisioned/attached through Vercel Marketplace (Neon, etc.). */
  database: {
    url:
      process.env.DATABASE_URL ??
      process.env.POSTGRES_URL ??
      process.env.POSTGRES_PRISMA_URL ??
      process.env.POSTGRES_URL_NON_POOLING ??
      "",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/google/callback",
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    tenant: process.env.MICROSOFT_TENANT ?? "common",
    redirectUri:
      process.env.MICROSOFT_REDIRECT_URI ?? "http://localhost:3000/api/microsoft/callback",
  },
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY ?? "",
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
  },
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    appSecret: process.env.WHATSAPP_APP_SECRET ?? "",
  },
  vapid: {
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
    subject: process.env.VAPID_SUBJECT ?? "mailto:danielrolmovil@gmail.com",
  },
  tasksSpreadsheetId: process.env.TASKS_SPREADSHEET_ID ?? "",
} as const;

export const ZERO_ATTRIBUTION = "(by zerodc)";

export function isPushConfigured(): boolean {
  return serverConfig.vapid.publicKey.length > 0 && serverConfig.vapid.privateKey.length > 0;
}

export function isMicrosoftConfigured(): boolean {
  return (
    serverConfig.microsoft.clientId.trim().length > 0 &&
    serverConfig.microsoft.clientSecret.trim().length > 0
  );
}

export function isWhatsappConfigured(): boolean {
  return (
    serverConfig.whatsapp.accessToken.length > 0 &&
    serverConfig.whatsapp.phoneNumberId.length > 0 &&
    serverConfig.whatsapp.verifyToken.length > 0
  );
}

export type ServiceStatus = "READY" | "MISSING" | "ERROR";

export interface Capability {
  key: string;
  label: string;
  status: ServiceStatus;
  detail: string;
  required: boolean;
}

export function computeCapabilities(): Capability[] {
  const c = serverConfig;
  const has = (v: string) => v.trim().length > 0;

  const databaseReady = has(c.database.url);
  const googleReady =
    has(c.google.clientId) && has(c.google.clientSecret) && has(c.tokenEncryptionKey);
  const anthropicReady = has(c.anthropic.apiKey);

  return [
    {
      key: "demo",
      label: "Modo demo",
      status: c.demoMode ? "READY" : "MISSING",
      detail: c.demoMode
        ? "ZERO funciona con datos simulados."
        : "Modo real activo (requiere credenciales).",
      required: false,
    },
    {
      key: "anthropic",
      label: "Anthropic (IA)",
      status: anthropicReady ? "READY" : "MISSING",
      detail: anthropicReady
        ? "Asistente con Claude disponible."
        : "Sin ANTHROPIC_API_KEY: se usa el asistente demo (NLU local).",
      required: false,
    },
    {
      key: "database",
      label: "Vercel Postgres",
      status: databaseReady ? "READY" : "MISSING",
      detail: databaseReady
        ? "Persistencia PostgreSQL conectada."
        : "Sin DATABASE_URL: preferencias y memoria usan almacenamiento temporal.",
      required: false,
    },
    {
      key: "google",
      label: "Google OAuth",
      status: googleReady ? "READY" : "MISSING",
      detail: googleReady
        ? "Conexión con Google disponible."
        : "Sin credenciales: Calendar/Tasks/Docs en modo demo.",
      required: false,
    },
    {
      key: "microsoft",
      label: "Microsoft / Outlook",
      status: isMicrosoftConfigured() ? "READY" : "MISSING",
      detail: isMicrosoftConfigured()
        ? "Conexión con Outlook (Microsoft To Do) disponible."
        : "Sin MICROSOFT_CLIENT_ID/SECRET: tareas de Outlook desactivadas.",
      required: false,
    },
  ];
}
