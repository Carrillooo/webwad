/**
 * Limitador mínimo en memoria para login/registro: frena fuerza bruta sin
 * infraestructura extra. Por instancia de servidor — suficiente como primera
 * barrera; el hash scrypt hace el resto.
 */
const g = globalThis as unknown as { __zeroRate?: Map<string, number[]> };
function bucket() {
  if (!g.__zeroRate) g.__zeroRate = new Map();
  return g.__zeroRate;
}

export function allowAttempt(key: string, max = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const hits = (bucket().get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    bucket().set(key, hits);
    return false;
  }
  hits.push(now);
  bucket().set(key, hits);
  return true;
}
