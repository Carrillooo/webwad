/**
 * Limitador de peticiones con ventana deslizante.
 *
 * Tramos:
 *   - auth         5 peticiones / 15 min  (login, registro, entrar con Google)
 *   - sensible    10 peticiones / 15 min  (administración, pagos, borrar cuenta)
 *   - ia          60 peticiones / 15 min  (asistente y voz: lo que cuesta dinero)
 *   - general    300 peticiones / 15 min  (lecturas: agenda, tareas, estado…)
 *
 * Por qué el general NO son 100: ZERO consulta su propio estado a menudo
 * (agenda, tareas, capacidades, sesión), así que un solo turno de conversación
 * son tres o cuatro peticiones. Con 100 cada cuarto de hora, una persona que
 * usara la app de verdad —o dos compañeros detrás de la misma IP de oficina o
 * de una red móvil con NAT— se quedaban fuera durante minutos. El abuso que
 * hay que frenar es el que cuesta dinero (la IA y la voz) y el que roba
 * cuentas (el login): ahí siguen los límites estrechos.
 *
 * La cuenta va por IDENTIDAD, no solo por IP: si hay sesión se usa la huella
 * de la cookie. Así una oficina entera detrás de la misma IP no se bloquea
 * entre sí, y a la vez un atacante sin sesión sigue limitado por IP.
 *
 * El estado vive en memoria del proceso. En Vercel hay varias instancias, así
 * que el límite real es aproximado (más permisivo, nunca más restrictivo);
 * es la primera barrera, no la única: detrás están la validación, el hash
 * lento de contraseñas y los permisos.
 */

export type Tramo = "general" | "auth" | "sensible" | "ia";

export interface LimiteConfig {
  max: number;
  ventanaMs: number;
}

const QUINCE_MIN = 15 * 60_000;

/** Se puede subir el general por variable de entorno sin tocar código. */
function numeroEnv(nombre: string, porDefecto: number): number {
  const v = Number(process.env[nombre]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : porDefecto;
}

export function configDe(tramo: Tramo): LimiteConfig {
  switch (tramo) {
    case "auth":
      return { max: numeroEnv("RATE_LIMIT_AUTH", 5), ventanaMs: QUINCE_MIN };
    case "sensible":
      return { max: numeroEnv("RATE_LIMIT_SENSIBLE", 10), ventanaMs: QUINCE_MIN };
    case "ia":
      return { max: numeroEnv("RATE_LIMIT_IA", 60), ventanaMs: QUINCE_MIN };
    default:
      return { max: numeroEnv("RATE_LIMIT_GENERAL", 300), ventanaMs: QUINCE_MIN };
  }
}

export interface Resultado {
  permitido: boolean;
  /** Peticiones que aún caben en la ventana. */
  restantes: number;
  /** Segundos hasta que se libere hueco (para Retry-After). */
  reintentarEnS: number;
  limite: number;
}

const g = globalThis as unknown as { __zeroRateBuckets?: Map<string, number[]> };
function cubos() {
  if (!g.__zeroRateBuckets) g.__zeroRateBuckets = new Map();
  return g.__zeroRateBuckets;
}

/** Evita que el mapa crezca sin fin si llegan muchas identidades distintas. */
function podar(ahora: number) {
  const c = cubos();
  if (c.size < 5000) return;
  for (const [k, v] of c) {
    if (!v.length || ahora - v[v.length - 1] > QUINCE_MIN) c.delete(k);
  }
}

/**
 * Consume una petición de la cuota. Devuelve si se permite y cuánto queda.
 * Llamar UNA vez por petición.
 */
export function consumir(clave: string, tramo: Tramo = "general", ahora = Date.now()): Resultado {
  const { max, ventanaMs } = configDe(tramo);
  const c = cubos();
  const k = `${tramo}:${clave}`;
  const previos = (c.get(k) ?? []).filter((t) => ahora - t < ventanaMs);

  if (previos.length >= max) {
    c.set(k, previos);
    const masAntiguo = previos[0];
    return {
      permitido: false,
      restantes: 0,
      reintentarEnS: Math.max(1, Math.ceil((ventanaMs - (ahora - masAntiguo)) / 1000)),
      limite: max,
    };
  }

  previos.push(ahora);
  c.set(k, previos);
  podar(ahora);
  return { permitido: true, restantes: max - previos.length, reintentarEnS: 0, limite: max };
}

/** Para los tests y para el reseteo total. */
export function reiniciarLimites(): void {
  g.__zeroRateBuckets = new Map();
}

/** Qué tramo corresponde a una ruta. */
export function tramoDeRuta(pathname: string): Tramo {
  if (
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/register" ||
    pathname.startsWith("/api/auth/google/start") ||
    pathname.startsWith("/api/auth/microsoft/start")
  ) {
    return "auth";
  }
  // Lo que gasta cuota de Anthropic o de ElevenLabs en cada llamada.
  if (pathname === "/api/assistant" || pathname === "/api/tts") {
    return "ia";
  }
  if (
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/calls") ||
    pathname.startsWith("/api/billing") ||
    pathname.startsWith("/api/push/send") ||
    // Borrar la cuenta y descargarse todos los datos son operaciones de una
    // vez y sin vuelta atrás: no hay motivo para permitir cien por cuarto de hora.
    pathname.startsWith("/api/account/")
  ) {
    return "sensible";
  }
  return "general";
}
