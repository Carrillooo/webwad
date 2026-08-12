/**
 * Central runtime configuration + capability detection.
 *
 * DEMO_MODE is the master switch. When true (or when a required credential
 * is missing) ZERO falls back to mock providers so the whole app is usable
 * without any external service configured.
 */

/** Demo mode is ON by default and only disabled by an explicit "false".
 *  This guarantees the app is usable before any credential is configured. */
function demoDefaultOn(): boolean {
  const raw = process.env.DEMO_MODE ?? process.env.NEXT_PUBLIC_DEMO_MODE;
  if (raw === undefined) return true;
  return raw !== "false" && raw !== "0";
}

/** Server-side view of the environment. Never expose secrets to the client. */
export const serverConfig = {
  demoMode: demoDefaultOn(),
  appUrl: process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/google/callback",
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
} as const;

export function isPushConfigured(): boolean {
  return serverConfig.vapid.publicKey.length > 0 && serverConfig.vapid.privateKey.length > 0;
}

export type ServiceStatus = "READY" | "MISSING" | "ERROR";

export interface Capability {
  key: string;
  label: string;
  status: ServiceStatus;
  detail: string;
  /** Whether this capability is required for the MVP. */
  required: boolean;
}

/** Computes which integrations are configured. Used by /setup and the API. */
export function computeCapabilities(): Capability[] {
  const c = serverConfig;
  const has = (v: string) => v.trim().length > 0;

  const supabaseReady = has(c.supabase.url) && has(c.supabase.anonKey);
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
      key: "supabase",
      label: "Supabase",
      status: supabaseReady ? "READY" : "MISSING",
      detail: supabaseReady
        ? "Auth y base de datos configuradas."
        : "Sin credenciales: preferencias en almacenamiento local.",
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
  ];
}
