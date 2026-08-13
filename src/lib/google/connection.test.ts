import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** Config mutable: cada test decide si hay cuenta preconfigurada. */
const google = {
  clientId: "cid",
  clientSecret: "csecret",
  redirectUri: "http://localhost:3000/api/google/callback",
  refreshToken: "",
  accountEmail: "",
};

vi.mock("../config", async () => {
  const actual = await vi.importActual<typeof import("../config")>("../config");
  return {
    ...actual,
    serverConfig: {
      ...actual.serverConfig,
      get google() {
        return google;
      },
    },
  };
});

const { getAccessToken, getConnection, isGooglePreconfigured } = await import("./connection");

const g = globalThis as unknown as { __zeroGoogleEnvTok?: unknown; __novaGoogle?: Map<string, unknown> };

function tokenResponse(access: string, expiresIn = 3600) {
  return new Response(JSON.stringify({ access_token: access, expires_in: expiresIn }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  Object.assign(google, { refreshToken: "", accountEmail: "" });
  g.__zeroGoogleEnvTok = undefined; // caché del access token entre peticiones
  g.__novaGoogle = undefined; // conexiones guardadas a mano
});
afterEach(() => vi.unstubAllGlobals());

describe("cuenta de Google preconfigurada", () => {
  it("sin GOOGLE_REFRESH_TOKEN sigue haciendo falta enlazar", async () => {
    expect(isGooglePreconfigured()).toBe(false);
    expect(await getConnection("u1", false)).toEqual({ connected: false });
    expect(await getAccessToken("u1", false)).toBeNull();
  });

  it("con GOOGLE_REFRESH_TOKEN aparece conectada sin pulsar nada", async () => {
    Object.assign(google, { refreshToken: "1//refresh", accountEmail: "daniel@ejemplo.com" });
    expect(isGooglePreconfigured()).toBe(true);
    expect(await getConnection("u1", false)).toMatchObject({
      connected: true,
      preconfigured: true,
      email: "daniel@ejemplo.com",
    });
  });

  it("canjea el refresh token por un access token", async () => {
    Object.assign(google, { refreshToken: "1//refresh" });
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => tokenResponse("ya29.token"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await getAccessToken("u1", false)).toBe("ya29.token");
    const body = String(fetchMock.mock.calls[0][1].body);
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=1%2F%2Frefresh");
  });

  it("cachea el access token en vez de pedir uno por petición", async () => {
    Object.assign(google, { refreshToken: "1//refresh" });
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => tokenResponse("ya29.token"));
    vi.stubGlobal("fetch", fetchMock);

    await getAccessToken("u1", false);
    await getAccessToken("u1", false);
    await getAccessToken("u1", false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("vuelve a pedirlo cuando está a punto de caducar", async () => {
    Object.assign(google, { refreshToken: "1//refresh" });
    // 30 s de vida: por debajo del margen de seguridad de 60 s.
    const fetchMock = vi.fn(async () => tokenResponse("ya29.corto", 30));
    vi.stubGlobal("fetch", fetchMock);

    await getAccessToken("u1", false);
    await getAccessToken("u1", false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("si Google revoca el token no revienta: degrada a los mocks", async () => {
    Object.assign(google, { refreshToken: "1//revocado" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("invalid_grant", { status: 400 })));
    // null = resolveProviders se queda con los mocks en vez de lanzar.
    await expect(getAccessToken("u1", false)).resolves.toBeNull();
  });
});
