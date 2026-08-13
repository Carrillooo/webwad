/**
 * Traduce el error de un callback de OAuth a un código corto para la URL.
 *
 * Sin esto, cualquier fallo acababa en un "error" genérico y el usuario tenía
 * que adivinar entre media docena de causas muy distintas.
 */
export type OAuthFailure =
  | "sin_cifrado" // falta TOKEN_ENCRYPTION_KEY: no se puede guardar el token
  | "sin_refresh" // el proveedor no devolvió refresh token (falta offline_access)
  | "token_rechazado" // rechazó el código o el secreto (secreto caducado, redirect distinto…)
  | "bd" // la base de datos no aceptó la escritura
  | "error"; // cualquier otra cosa: hay que mirar el log

export function classifyOAuthError(e: unknown): OAuthFailure {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/TOKEN_ENCRYPTION_KEY/i.test(msg)) return "sin_cifrado";
  if (/refresh token/i.test(msg)) return "sin_refresh";
  if (/token error|invalid_client|invalid_grant|unauthorized_client/i.test(msg)) {
    return "token_rechazado";
  }
  if (/relation|column|constraint|postgres|connect|ECONNREFUSED|timeout/i.test(msg)) return "bd";
  return "error";
}
