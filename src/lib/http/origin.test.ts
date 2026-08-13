import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { requestOrigin, appHome } from "./origin";

/** NextRequest mínimo: solo lo que lee requestOrigin. */
function req(headers: Record<string, string>, nextUrlOrigin?: string): NextRequest {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: { get: (k: string) => map.get(k.toLowerCase()) ?? null },
    nextUrl: nextUrlOrigin ? { origin: nextUrlOrigin } : undefined,
  } as unknown as NextRequest;
}

describe("requestOrigin", () => {
  it("detrás de Vercel usa x-forwarded-*, no APP_URL", () => {
    expect(
      requestOrigin(req({ "x-forwarded-host": "webwad-6t4y.vercel.app", "x-forwarded-proto": "https" })),
    ).toBe("https://webwad-6t4y.vercel.app");
  });

  it("en local mantiene http y el puerto", () => {
    expect(requestOrigin(req({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(requestOrigin(req({ host: "127.0.0.1:3000" }))).toBe("http://127.0.0.1:3000");
  });

  it("un host público sin x-forwarded-proto se asume https", () => {
    expect(requestOrigin(req({ host: "webwad-6t4y.vercel.app" }))).toBe("https://webwad-6t4y.vercel.app");
  });

  it("x-forwarded-proto con varios valores se queda con el primero", () => {
    expect(
      requestOrigin(req({ "x-forwarded-host": "mi.app", "x-forwarded-proto": "https, http" })),
    ).toBe("https://mi.app");
  });

  it("x-forwarded-host manda sobre host", () => {
    expect(
      requestOrigin(req({ host: "interno:3000", "x-forwarded-host": "mi.app", "x-forwarded-proto": "https" })),
    ).toBe("https://mi.app");
  });

  it("sin cabeceras cae en nextUrl.origin", () => {
    expect(requestOrigin(req({}, "https://otra.app"))).toBe("https://otra.app");
  });

  it("appHome devuelve la home de ese mismo origen", () => {
    const home = appHome(req({ "x-forwarded-host": "webwad-6t4y.vercel.app", "x-forwarded-proto": "https" }));
    home.searchParams.set("google", "connected");
    expect(home.toString()).toBe("https://webwad-6t4y.vercel.app/?google=connected");
  });
});
