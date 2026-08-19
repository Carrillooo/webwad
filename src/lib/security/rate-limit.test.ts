import { describe, it, expect, beforeEach } from "vitest";
import { consumir, configDe, tramoDeRuta, reiniciarLimites } from "./rate-limit";

describe("límite de peticiones", () => {
  beforeEach(() => reiniciarLimites());

  it("deja pasar hasta el máximo y bloquea la siguiente", () => {
    const max = configDe("auth").max;
    for (let i = 0; i < max; i++) {
      expect(consumir("ip:1.2.3.4", "auth").permitido).toBe(true);
    }
    const r = consumir("ip:1.2.3.4", "auth");
    expect(r.permitido).toBe(false);
    expect(r.restantes).toBe(0);
    expect(r.reintentarEnS).toBeGreaterThan(0);
  });

  it("cuenta cada identidad por separado", () => {
    for (let i = 0; i < configDe("auth").max; i++) consumir("ip:1.1.1.1", "auth");
    expect(consumir("ip:1.1.1.1", "auth").permitido).toBe(false);
    expect(consumir("ip:2.2.2.2", "auth").permitido).toBe(true);
  });

  it("no mezcla tramos: agotar auth no toca el general", () => {
    for (let i = 0; i < configDe("auth").max; i++) consumir("ip:9.9.9.9", "auth");
    expect(consumir("ip:9.9.9.9", "auth").permitido).toBe(false);
    expect(consumir("ip:9.9.9.9", "general").permitido).toBe(true);
  });

  it("la ventana es deslizante: al caducar vuelve a dejar pasar", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < configDe("auth").max; i++) consumir("ip:8.8.8.8", "auth", t0);
    expect(consumir("ip:8.8.8.8", "auth", t0 + 1000).permitido).toBe(false);
    // 15 minutos y un segundo después ya no cuenta ninguna de las anteriores.
    expect(consumir("ip:8.8.8.8", "auth", t0 + 15 * 60_000 + 1000).permitido).toBe(true);
  });

  it("clasifica las rutas en el tramo que toca", () => {
    expect(tramoDeRuta("/api/auth/login")).toBe("auth");
    expect(tramoDeRuta("/api/auth/register")).toBe("auth");
    expect(tramoDeRuta("/api/auth/google/start")).toBe("auth");
    expect(tramoDeRuta("/api/admin/users")).toBe("sensible");
    expect(tramoDeRuta("/api/calls/start")).toBe("sensible");
    expect(tramoDeRuta("/api/account/delete")).toBe("sensible");
    expect(tramoDeRuta("/api/account/export")).toBe("sensible");
    expect(tramoDeRuta("/api/assistant")).toBe("ia");
    expect(tramoDeRuta("/api/tts")).toBe("ia");
    expect(tramoDeRuta("/api/calendar")).toBe("general");
  });

  it("los límites son los de la política del proyecto", () => {
    expect(configDe("auth").max).toBe(5);
    expect(configDe("sensible").max).toBe(10);
    expect(configDe("ia").max).toBe(60);
    expect(configDe("general").max).toBe(300);
    expect(configDe("general").ventanaMs).toBe(15 * 60_000);
  });
});
