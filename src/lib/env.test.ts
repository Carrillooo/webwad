import { describe, it, expect, vi, afterEach } from "vitest";

/** Reconstruye la configuración con el entorno que le pasemos. */
async function revisarCon(env: Record<string, string>, prod = true) {
  vi.resetModules();
  const previo = { ...process.env };
  for (const k of Object.keys(process.env)) {
    if (/^(GOOGLE|MICROSOFT|DATABASE|POSTGRES|TOKEN_ENC|ANTHROPIC|DEMO|APP_URL|NEXT_PUBLIC)/.test(k)) {
      delete process.env[k];
    }
  }
  Object.assign(process.env, env);
  const { revisarEntorno } = await import("./env");
  const out = revisarEntorno(prod);
  process.env = previo;
  return out;
}

describe("revisión del entorno al arrancar", () => {
  afterEach(() => vi.resetModules());

  it("no arranca si hay OAuth y falta la clave de cifrado de tokens", async () => {
    const { errores } = await revisarCon({
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secreto",
      DATABASE_URL: "postgres://x",
    });
    expect(errores.join(" ")).toContain("TOKEN_ENCRYPTION_KEY");
  });

  it("no arranca con OAuth a medias", async () => {
    const { errores } = await revisarCon({
      GOOGLE_CLIENT_ID: "id",
      TOKEN_ENCRYPTION_KEY: "clave-larguisima-de-mas-de-32-caracteres",
      DATABASE_URL: "postgres://x",
    });
    expect(errores.join(" ")).toContain("Google OAuth incompleto");
  });

  it("no arranca en producción sin base de datos", async () => {
    const { errores } = await revisarCon({});
    expect(errores.join(" ")).toContain("DATABASE_URL");
  });

  it("rechaza una clave de cifrado de juguete en producción", async () => {
    const { errores } = await revisarCon({
      TOKEN_ENCRYPTION_KEY: "cambiame",
      DATABASE_URL: "postgres://x",
    });
    expect(errores.join(" ")).toContain("TOKEN_ENCRYPTION_KEY");
  });

  it("arranca sin credenciales en desarrollo (regla «demo primero»)", async () => {
    const { errores } = await revisarCon({}, false);
    expect(errores).toEqual([]);
  });

  it("una configuración completa y sana no da errores", async () => {
    const { errores } = await revisarCon({
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secreto",
      TOKEN_ENCRYPTION_KEY: "clave-larguisima-de-mas-de-32-caracteres",
      DATABASE_URL: "postgres://x",
      ANTHROPIC_API_KEY: "sk-ant-x",
      APP_URL: "https://zero.app",
      GOOGLE_REDIRECT_URI: "https://zero.app/api/google/callback",
      MICROSOFT_REDIRECT_URI: "https://zero.app/api/microsoft/callback",
    });
    expect(errores).toEqual([]);
  });
});
