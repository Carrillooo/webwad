/**
 * Registro de seguridad. Va a los logs del servidor (en Vercel:
 * Observability → Logs) con un prefijo buscable.
 *
 * REGLA: aquí NUNCA entra nada sensible. Ni contraseñas, ni tokens, ni
 * cookies, ni el contenido de los correos o los eventos del usuario. Solo
 * qué pasó, dónde y con qué identidad aproximada.
 */

export type SecurityEvent =
  | "auth.fallo" // credenciales incorrectas
  | "auth.bloqueo" // demasiados intentos
  | "rate.limite" // se pasó del límite de peticiones
  | "input.rechazado" // no pasó la validación (posible inyección)
  | "origen.rechazado" // petición cruzada sospechosa (CSRF)
  | "acceso.denegado" // sin sesión o sin permiso
  | "webhook.firma"; // firma inválida en un webhook

/** Las claves que jamás deben acabar en un log, vengan de donde vengan. */
const PROHIBIDAS =
  /^(password|pass|contrase|token|secret|authorization|cookie|code|refresh|access|key|body|content|text|email)/i;

function limpia(datos: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(datos)) {
    if (PROHIBIDAS.test(k)) {
      out[k] = "[oculto]";
      continue;
    }
    if (typeof v === "string") out[k] = v.slice(0, 120);
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else out[k] = typeof v; // nada de volcar objetos enteros
  }
  return out;
}

/** Un email en un log es un dato personal: se guarda solo el dominio. */
export function dominioDe(email: string): string {
  const at = email.lastIndexOf("@");
  return at > 0 ? `@${email.slice(at + 1)}`.slice(0, 40) : "(sin dominio)";
}

/** Identidad aproximada para poder correlacionar sin identificar a nadie. */
export function huellaCliente(ip: string): string {
  // Solo los dos primeros octetos: sirve para ver un ataque, no para seguir a
  // una persona (y una IP completa es dato personal bajo el RGPD).
  const partes = ip.split(".");
  return partes.length === 4 ? `${partes[0]}.${partes[1]}.x.x` : "ip";
}

export function logSeguridad(evento: SecurityEvent, datos: Record<string, unknown> = {}): void {
  console.warn(`[seguridad] ${evento}`, JSON.stringify(limpia(datos)));
}
