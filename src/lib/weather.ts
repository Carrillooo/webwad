/** Weather via Open-Meteo (keyless). Defaults to Madrid. */

const WMO: Record<number, string> = {
  0: "despejado",
  1: "mayormente despejado",
  2: "parcialmente nublado",
  3: "nublado",
  45: "niebla",
  48: "niebla con escarcha",
  51: "llovizna débil",
  53: "llovizna",
  55: "llovizna intensa",
  61: "lluvia débil",
  63: "lluvia",
  65: "lluvia intensa",
  71: "nieve débil",
  73: "nieve",
  75: "nieve intensa",
  80: "chubascos débiles",
  81: "chubascos",
  82: "chubascos fuertes",
  95: "tormenta",
  96: "tormenta con granizo",
  99: "tormenta fuerte con granizo",
};

export interface DayForecast {
  date: string; // YYYY-MM-DD
  min: number;
  max: number;
  rainChance: number; // %
  summary: string;
}

export async function getForecast(
  lat = 40.4168,
  lon = -3.7038,
): Promise<{ ok: true; days: DayForecast[] } | { ok: false; error: string }> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode` +
      `&timezone=Europe%2FMadrid&forecast_days=7`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, error: `Open-Meteo devolvió ${res.status}` };
    const j = (await res.json()) as {
      daily?: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: (number | null)[];
        weathercode: number[];
      };
    };
    const d = j.daily;
    if (!d?.time?.length) return { ok: false, error: "respuesta sin datos" };
    const days = d.time.map((date, i) => ({
      date,
      min: Math.round(d.temperature_2m_min[i]),
      max: Math.round(d.temperature_2m_max[i]),
      rainChance: d.precipitation_probability_max[i] ?? 0,
      summary: WMO[d.weathercode[i]] ?? "variable",
    }));
    return { ok: true, days };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error de red" };
  }
}
