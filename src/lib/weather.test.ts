import { describe, it, expect, vi, afterEach } from "vitest";
import { getForecast } from "./weather";

const DAILY = {
  daily: {
    time: ["2026-08-13", "2026-08-14"],
    temperature_2m_max: [33.4, 29.8],
    temperature_2m_min: [19.2, 17.6],
    precipitation_probability_max: [5, null],
    weathercode: [0, 61],
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("getForecast (Open-Meteo)", () => {
  it("maps the daily payload to rounded, Spanish-labelled days", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(DAILY), { status: 200 })));
    const r = await getForecast();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.days).toHaveLength(2);
    expect(r.days[0]).toEqual({
      date: "2026-08-13",
      min: 19,
      max: 33,
      rainChance: 5,
      summary: "despejado",
    });
    // A null precipitation probability must not leak through as null.
    expect(r.days[1].rainChance).toBe(0);
    expect(r.days[1].summary).toBe("lluvia débil");
  });

  it("asks Madrid + Europe/Madrid by default", async () => {
    const spy = vi.fn(async (_url: string) => new Response(JSON.stringify(DAILY), { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await getForecast();
    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain("latitude=40.4168");
    expect(url).toContain("longitude=-3.7038");
    expect(url).toContain("timezone=Europe%2FMadrid");
  });

  it("never throws: HTTP errors and network failures come back as ok:false", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    expect((await getForecast()).ok).toBe(false);

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("ENOTFOUND");
    }));
    const r = await getForecast();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("ENOTFOUND");
  });

  it("treats an empty payload as an error instead of inventing weather", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));
    expect((await getForecast()).ok).toBe(false);
  });
});
