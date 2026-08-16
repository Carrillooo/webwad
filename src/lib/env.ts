import { serverConfig } from "./config";

/**
 * Comprobación del entorno al arrancar.
 *
 * ZERO tiene que poder arrancar SIN credenciales (regla «demo primero» de
 * CLAUDE.md), así que aquí no se exige que estén todas las variables: se
 * exige que la configuración sea COHERENTE y SEGURA. Lo que se busca es la
 * combinación peligrosa — la que hace que la app parezca que funciona pero
 * deje datos al aire o rompa a la primera petición real.
 *
 * `error` → la app no debe arrancar. `aviso` → se anota y sigue.
 */

export interface RevisionEntorno {
  errores: string[];
  avisos: string[];
}

const hay = (v: string | undefined) => (v ?? "").trim().length > 0;

/** Un secreto que en producción es de juguete es peor que no tener ninguno. */
function pareceDePrueba(v: string): boolean {
  const s = v.trim().toLowerCase();
  return (
    s.length < 16 ||
    ["cambiame", "changeme", "secret", "test", "demo", "xxx", "todo", "placeholder"].some((p) =>
      s.startsWith(p),
    )
  );
}

export function revisarEntorno(prod = process.env.NODE_ENV === "production"): RevisionEntorno {
  const errores: string[] = [];
  const avisos: string[] = [];
  const c = serverConfig;

  // 1) Tokens de Google/Microsoft cifrados en la base de datos: sin clave de
  //    cifrado se guardarían tal cual. Eso no se arranca.
  const usaOAuth = hay(c.google.clientId) || hay(c.microsoft.clientId);
  if (usaOAuth && !hay(c.tokenEncryptionKey)) {
    errores.push(
      "TOKEN_ENCRYPTION_KEY falta y hay OAuth configurado: los tokens de Google/Microsoft se guardarían sin cifrar.",
    );
  }
  if (hay(c.tokenEncryptionKey) && prod && pareceDePrueba(c.tokenEncryptionKey)) {
    errores.push("TOKEN_ENCRYPTION_KEY es demasiado corta o de ejemplo. Genera una de 32+ caracteres.");
  }

  // 2) OAuth a medias: un client_id sin secret hace que el login falle
  //    justo al volver de Google, con el usuario ya fuera de la web.
  if (hay(c.google.clientId) !== hay(c.google.clientSecret)) {
    errores.push("Google OAuth incompleto: hacen falta GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET, o ninguno.");
  }
  if (hay(c.microsoft.clientId) !== hay(c.microsoft.clientSecret)) {
    errores.push(
      "Microsoft OAuth incompleto: hacen falta MICROSOFT_CLIENT_ID y MICROSOFT_CLIENT_SECRET, o ninguno.",
    );
  }

  // 3) En producción, cuentas de verdad: sin base de datos no hay sesiones ni
  //    suscripciones, y cualquiera entraría sin identificarse.
  if (prod && !c.demoMode && !hay(c.database.url)) {
    errores.push("DATABASE_URL falta en producción: sin ella no hay cuentas, sesiones ni suscripciones.");
  }

  // 4) Modo demo en producción: se arranca, pero que quede dicho.
  if (prod && c.demoMode) {
    avisos.push("DEMO_MODE está activo en producción: los datos son simulados y no se guarda nada.");
  }

  // 5) Redirecciones de OAuth apuntando a localhost en producción.
  if (prod) {
    for (const [nombre, url] of [
      ["GOOGLE_REDIRECT_URI", c.google.redirectUri],
      ["MICROSOFT_REDIRECT_URI", c.microsoft.redirectUri],
      ["APP_URL", c.appUrl],
    ] as const) {
      if (url.includes("localhost")) avisos.push(`${nombre} apunta a localhost en producción (${url}).`);
    }
  }

  // 6) Capacidades opcionales que la web ofrece pero no podrá cumplir.
  if (!hay(c.anthropic.apiKey)) {
    avisos.push("Sin ANTHROPIC_API_KEY: el asistente responde con el cerebro local (más limitado).");
  }

  return { errores, avisos };
}

/** Arranque: escribe el resultado y corta si algo es insalvable. */
export function validarEntornoAlArrancar(): void {
  const { errores, avisos } = revisarEntorno();
  for (const a of avisos) console.warn(`[entorno] aviso: ${a}`);
  if (errores.length === 0) return;
  for (const e of errores) console.error(`[entorno] ERROR: ${e}`);
  throw new Error(
    `ZERO no arranca: la configuración no es segura (${errores.length} problema(s)). Revisa .env.example.`,
  );
}
