import { describe, it, expect } from "vitest";
import { classifyOAuthError } from "./oauth-error";

describe("classifyOAuthError", () => {
  it("detecta que falta la clave de cifrado", () => {
    expect(classifyOAuthError(new Error("TOKEN_ENCRYPTION_KEY no está configurada"))).toBe(
      "sin_cifrado",
    );
  });

  it("detecta que no vino refresh token (falta offline_access)", () => {
    expect(
      classifyOAuthError(new Error("Microsoft no devolvió refresh token (falta offline_access)")),
    ).toBe("sin_refresh");
    expect(
      classifyOAuthError(new Error("Google no devolvió refresh token (usa prompt=consent)")),
    ).toBe("sin_refresh");
  });

  it("detecta credenciales rechazadas", () => {
    expect(classifyOAuthError(new Error('Microsoft token error 401: {"error":"invalid_client"}'))).toBe(
      "token_rechazado",
    );
    expect(classifyOAuthError(new Error('Google token error 400: {"error":"invalid_grant"}'))).toBe(
      "token_rechazado",
    );
  });

  it("detecta fallos de base de datos", () => {
    expect(classifyOAuthError(new Error('relation "oauth_credentials" does not exist'))).toBe("bd");
    expect(classifyOAuthError(new Error("connect ECONNREFUSED 10.0.0.1:5432"))).toBe("bd");
  });

  it("lo demás cae en error genérico, sin reventar", () => {
    expect(classifyOAuthError(new Error("vete a saber"))).toBe("error");
    expect(classifyOAuthError(null)).toBe("error");
    expect(classifyOAuthError(undefined)).toBe("error");
    expect(classifyOAuthError("texto suelto")).toBe("error");
  });

  it("la clave de cifrado manda sobre el resto (es la causa raíz)", () => {
    expect(
      classifyOAuthError(new Error("TOKEN_ENCRYPTION_KEY no está configurada al guardar refresh token")),
    ).toBe("sin_cifrado");
  });
});
