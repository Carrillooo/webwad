import { computeCapabilities, serverConfig } from "@/lib/config";
import Link from "next/link";

/** Setup wizard. Server component: reads config (never secrets) and renders
 *  READY / MISSING status per integration with exact instructions. */
export const dynamic = "force-dynamic";

interface Guide {
  key: string;
  title: string;
  need: string;
  why: string;
  where: string;
  steps: string[];
  vars: string[];
  verify: string;
}

const GUIDES: Record<string, Guide> = {
  anthropic: {
    key: "anthropic",
    title: "Anthropic (motor de IA)",
    need: "ANTHROPIC_API_KEY",
    why: "Permite que ZERO use Claude con tool-calling en vez del asistente demo.",
    where: "https://console.anthropic.com/settings/keys",
    steps: [
      "Entra en console.anthropic.com e inicia sesión.",
      "Ve a Settings → API Keys.",
      "Crea una nueva API key y cópiala.",
      "Añádela en Vercel como ANTHROPIC_API_KEY.",
      "Pon DEMO_MODE=false para activar el modo real.",
    ],
    vars: ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"],
    verify: "Recarga /setup: Anthropic debe aparecer como READY.",
  },
  database: {
    key: "database",
    title: "Base de datos de Vercel (PostgreSQL)",
    need: "DATABASE_URL o una URL PostgreSQL equivalente",
    why: "Guarda preferencias, memoria, conexiones, tokens cifrados, notificaciones, sesiones, mensajes y logs de ZERO.",
    where: "https://vercel.com/dashboard",
    steps: [
      "Abre el proyecto webwad-6t4y en Vercel.",
      "Conecta la base PostgreSQL que has creado al proyecto.",
      "Comprueba que la integración añade DATABASE_URL o una variable PostgreSQL equivalente al entorno del despliegue.",
      "No copies la contraseña ni la URL de la base dentro del repositorio.",
      "Despliega de nuevo: ZERO crea automáticamente las tablas necesarias al primer uso.",
    ],
    vars: ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING"],
    verify: "Recarga /setup o /api/health: Vercel Postgres debe aparecer como READY y database=true.",
  },
  google: {
    key: "google",
    title: "Google OAuth (Calendar / Tasks / Drive / Docs)",
    need: "OAuth Client ID + Secret",
    why: "Conecta tu Google real para leer y crear eventos, tareas y documentos.",
    where: "https://console.cloud.google.com/apis/credentials",
    steps: [
      "Abre Google Cloud Console y crea (o elige) un proyecto.",
      "APIs & Services → Enabled APIs: habilita Calendar, Tasks, Drive y Docs API.",
      "OAuth consent screen: configúralo y añádete como usuario de prueba si aplica.",
      "Credentials → Create credentials → OAuth client ID → Web application.",
      "Añade la URL de producción de /api/google/callback como Authorized redirect URI.",
      "Copia el Client ID y el Client Secret a las variables de entorno de Vercel.",
      "Genera TOKEN_ENCRYPTION_KEY y guárdala únicamente en Vercel.",
    ],
    vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "TOKEN_ENCRYPTION_KEY"],
    verify: "Recarga /setup: Google OAuth debe aparecer como READY. Luego conecta tu cuenta desde Configuración.",
  },
};

function Badge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    READY: { bg: "rgba(52,211,153,0.15)", fg: "rgb(52 211 153)" },
    MISSING: { bg: "rgba(251,191,36,0.15)", fg: "rgb(251 191 36)" },
    ERROR: { bg: "rgba(248,113,113,0.15)", fg: "rgb(248 113 113)" },
  };
  const s = map[status] ?? map.MISSING;
  return (
    <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: s.bg, color: s.fg }}>
      {status}
    </span>
  );
}

export default function SetupPage() {
  const caps = computeCapabilities();

  return (
    <main className="max-w-2xl mx-auto p-5 sm:p-8 overflow-y-auto nova-scroll" style={{ maxHeight: "100dvh" }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-medium glow-text">Configuración de ZERO</h1>
        <Link href="/" className="text-sm text-dim hover:text-fg">← Volver</Link>
      </div>

      <p className="text-dim text-sm mb-6">
        ZERO funciona ahora mismo en{" "}
        <strong>modo demo</strong> {serverConfig.demoMode ? "(activo)" : "(inactivo)"}. Conecta estos servicios
        para activar las funciones reales. Los secretos nunca se muestran aquí.
      </p>

      <div className="space-y-3 mb-8">
        {caps.map((c) => (
          <div key={c.key} className="glass holo-border p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">{c.label}</div>
              <div className="text-xs text-dim">{c.detail}</div>
            </div>
            <Badge status={c.status} />
          </div>
        ))}
      </div>

      <h2 className="text-lg font-medium mb-3">Guías de conexión</h2>
      <div className="space-y-4">
        {Object.values(GUIDES).map((g) => (
          <details key={g.key} className="glass holo-border p-4">
            <summary className="cursor-pointer font-medium">{g.title}</summary>
            <div className="mt-3 text-sm space-y-2 text-dim">
              <p><strong className="text-fg">Necesitas:</strong> {g.need}</p>
              <p><strong className="text-fg">Por qué:</strong> {g.why}</p>
              <p>
                <strong className="text-fg">Dónde:</strong>{" "}
                <a href={g.where} target="_blank" rel="noreferrer" className="underline" style={{ color: "rgb(var(--nova-accent))" }}>
                  {g.where}
                </a>
              </p>
              <div>
                <strong className="text-fg">Pasos:</strong>
                <ol className="list-decimal ml-5 mt-1 space-y-1">
                  {g.steps.map((s, i) => (<li key={i}>{s}</li>))}
                </ol>
              </div>
              <p><strong className="text-fg">Variables .env:</strong> <code className="text-xs">{g.vars.join(", ")}</code></p>
              <p><strong className="text-fg">Comprobar:</strong> {g.verify}</p>
            </div>
          </details>
        ))}
      </div>

      <p className="text-xs text-faint mt-8">
        Micrófono, PWA y voz se comprueban en el propio dispositivo al usar ZERO. WhatsApp es opcional
        (ver docs/WHATSAPP_OPTIONAL.md).
      </p>
    </main>
  );
}
