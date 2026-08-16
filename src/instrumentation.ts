/**
 * Se ejecuta UNA vez, al arrancar el servidor, antes de atender nada.
 * Aquí se comprueba que el entorno es coherente: si la configuración es
 * insegura, ZERO no llega a servir la primera petición.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { validarEntornoAlArrancar } = await import("./lib/env");
  validarEntornoAlArrancar();
}
