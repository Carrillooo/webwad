import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { saveConnection, getConnection, getAccessToken, disconnect } from "./connection";

/** Conexión por usuario (camino en memoria: sin DATABASE_URL en tests). */

const g = globalThis as unknown as { __novaGoogle?: Map<string, unknown> };

function tokens(expiresInMs: number) {
  return {
    accessToken: "ya29.acceso",
    refreshToken: "1//refresh",
    expiresAt: Date.now() + expiresInMs,
  };
}

beforeEach(() => {
  g.__novaGoogle = undefined;
});
afterEach(() => vi.unstubAllGlobals());

describe("conexión de Google por usuario", () => {
  it("sin conectar no hay nada: ni conexión ni token", async () => {
    expect(await getConnection("u1", false)).toEqual({ connected: false });
    expect(await getAccessToken("u1", false)).toBeNull();
  });

  it("guardar y leer: cada usuario ve SOLO su conexión", async () => {
    await saveConnection("u1", false, tokens(3600_000), "uno@ejemplo.com");
    expect(await getConnection("u1", false)).toMatchObject({ connected: true, email: "uno@ejemplo.com" });
    // El vecino no ve nada — esta es la garantía multiusuario.
    expect(await getConnection("u2", false)).toEqual({ connected: false });
    expect(await getAccessToken("u2", false)).toBeNull();
  });

  it("guardar exige refresh token (nunca una conexión que morirá en 1 h)", async () => {
    await expect(
      saveConnection("u1", false, { accessToken: "x", expiresAt: Date.now() + 1000 }, "a@b.com"),
    ).rejects.toThrow(/refresh token/);
  });

  it("con el access token vigente no llama a Google", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await saveConnection("u1", false, tokens(3600_000));
    expect(await getAccessToken("u1", false)).toBe("ya29.acceso");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caducado el access token, lo renueva con el refresh", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(JSON.stringify({ access_token: "ya29.nuevo", expires_in: 3600 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await saveConnection("u1", false, tokens(-1000)); // ya caducado
    expect(await getAccessToken("u1", false)).toBe("ya29.nuevo");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = String(fetchMock.mock.calls[0][1].body);
    expect(body).toContain("grant_type=refresh_token");
  });

  it("desconectar borra la conexión de ese usuario y solo la suya", async () => {
    await saveConnection("u1", false, tokens(3600_000), "uno@ejemplo.com");
    await saveConnection("u2", false, tokens(3600_000), "dos@ejemplo.com");
    await disconnect("u1", false);
    expect(await getConnection("u1", false)).toEqual({ connected: false });
    expect(await getConnection("u2", false)).toMatchObject({ connected: true });
  });
});
