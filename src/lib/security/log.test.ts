import { describe, it, expect, vi, afterEach } from "vitest";
import { logSeguridad, dominioDe, huellaCliente } from "./log";

describe("registro de seguridad", () => {
  afterEach(() => vi.restoreAllMocks());

  it("nunca escribe contraseñas, tokens ni el texto del usuario", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logSeguridad("auth.fallo", {
      password: "secreta123",
      token: "abc.def",
      cookie: "zero_session=x",
      email: "adrian@ejemplo.com",
      text: "contenido privado",
      ruta: "/api/auth/login",
    });
    const salida = spy.mock.calls[0].join(" ");
    expect(salida).not.toContain("secreta123");
    expect(salida).not.toContain("abc.def");
    expect(salida).not.toContain("adrian@ejemplo.com");
    expect(salida).not.toContain("contenido privado");
    expect(salida).toContain("/api/auth/login");
  });

  it("de un email solo guarda el dominio", () => {
    expect(dominioDe("adrian@ejemplo.com")).toBe("@ejemplo.com");
    expect(dominioDe("sin-arroba")).toBe("(sin dominio)");
  });

  it("de una IP solo guarda los dos primeros octetos", () => {
    expect(huellaCliente("83.45.12.9")).toBe("83.45.x.x");
    expect(huellaCliente("::1")).toBe("ip");
  });
});
