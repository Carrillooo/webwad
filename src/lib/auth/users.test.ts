import { describe, it, expect, beforeEach } from "vitest";
import {
  registerUser,
  verifyLogin,
  createSession,
  getUserBySession,
  destroySession,
  subscriptionOf,
  hashPassword,
  verifyPassword,
  listBillableUsers,
  PLAN,
  type AuthUser,
} from "./users";

const g = globalThis as unknown as {
  __zeroAuthUsers?: Map<string, unknown>;
  __zeroAuthSessions?: Map<string, unknown>;
};

beforeEach(() => {
  g.__zeroAuthUsers = undefined;
  g.__zeroAuthSessions = undefined;
});

describe("contraseñas", () => {
  it("nunca se guardan en claro y verifican bien", () => {
    const h = hashPassword("mi-contraseña-8");
    expect(h).not.toContain("mi-contraseña-8");
    expect(verifyPassword("mi-contraseña-8", h)).toBe(true);
    expect(verifyPassword("otra-cosa-123", h)).toBe(false);
  });

  it("dos hashes de la misma contraseña difieren (sal aleatoria)", () => {
    expect(hashPassword("igualigual")).not.toBe(hashPassword("igualigual"));
  });
});

describe("registro", () => {
  it("valida email, contraseña y nombre", async () => {
    expect(await registerUser("no-es-email", "12345678", "Ana")).toEqual({ error: "email_invalido" });
    expect(await registerUser("ana@ejemplo.com", "corta", "Ana")).toEqual({ error: "password_corta" });
    expect(await registerUser("ana@ejemplo.com", "12345678", "   ")).toEqual({ error: "nombre_vacio" });
  });

  it("no permite dos cuentas con el mismo email (ni con mayúsculas)", async () => {
    await registerUser("ana@ejemplo.com", "12345678", "Ana");
    expect(await registerUser("ANA@ejemplo.com", "87654321", "Otra")).toEqual({ error: "email_en_uso" });
  });

  it("la primera cuenta es la fundadora: activa para siempre", async () => {
    const out = await registerUser("dueño@ejemplo.com", "12345678", "Daniel");
    if ("error" in out) throw new Error(out.error);
    expect(out.user.isOwner).toBe(true);
    expect(subscriptionOf(out.user)).toEqual({ status: "active", daysLeft: null, trialEndsAt: null });
  });

  it("las siguientes empiezan la prueba de 14 días del plan", async () => {
    await registerUser("dueño@ejemplo.com", "12345678", "Daniel");
    const out = await registerUser("cliente@ejemplo.com", "12345678", "Cliente");
    if ("error" in out) throw new Error(out.error);
    expect(out.user.isOwner).toBe(false);
    const sub = subscriptionOf(out.user);
    expect(sub.status).toBe("trial");
    expect(sub.daysLeft).toBe(PLAN.trialDays);
  });
});

describe("login y sesiones", () => {
  it("entra con la contraseña correcta y rechaza la incorrecta", async () => {
    await registerUser("ana@ejemplo.com", "12345678", "Ana");
    expect(await verifyLogin("ana@ejemplo.com", "12345678")).toMatchObject({ email: "ana@ejemplo.com" });
    expect(await verifyLogin("ana@ejemplo.com", "malamala")).toBeNull();
    expect(await verifyLogin("nadie@ejemplo.com", "12345678")).toBeNull();
  });

  it("la sesión devuelve al usuario y el logout la mata", async () => {
    const out = await registerUser("ana@ejemplo.com", "12345678", "Ana");
    if ("error" in out) throw new Error(out.error);
    const { token } = await createSession(out.user.id);
    expect(await getUserBySession(token)).toMatchObject({ email: "ana@ejemplo.com" });
    await destroySession(token);
    expect(await getUserBySession(token)).toBeNull();
  });

  it("un token inventado no vale", async () => {
    expect(await getUserBySession("token-falso")).toBeNull();
    expect(await getUserBySession("")).toBeNull();
  });
});

describe("suscripción", () => {
  const base: AuthUser = {
    id: "u1",
    email: "a@b.com",
    displayName: "Ana",
    subscriptionStatus: "trial",
    trialEndsAt: null,
    isOwner: false,
    createdAt: new Date().toISOString(),
  };

  it("prueba vigente → trial con días restantes", () => {
    const u = { ...base, trialEndsAt: new Date(Date.now() + 3.5 * 86_400_000).toISOString() };
    const sub = subscriptionOf(u);
    expect(sub.status).toBe("trial");
    expect(sub.daysLeft).toBe(4); // se redondea hacia arriba: el día en curso cuenta
  });

  it("prueba pasada → expired (y el guard devolverá 402)", () => {
    const u = { ...base, trialEndsAt: new Date(Date.now() - 1000).toISOString() };
    expect(subscriptionOf(u).status).toBe("expired");
  });

  it("cuenta activa → nunca caduca", () => {
    const u: AuthUser = { ...base, subscriptionStatus: "active" };
    expect(subscriptionOf(u).status).toBe("active");
  });

  it("los crons saltan a los caducados", async () => {
    await registerUser("dueño@ejemplo.com", "12345678", "Daniel"); // activa
    const out = await registerUser("cliente@ejemplo.com", "12345678", "Cliente"); // trial
    if ("error" in out) throw new Error(out.error);
    expect((await listBillableUsers()).map((u) => u.email).sort()).toEqual([
      "cliente@ejemplo.com",
      "dueño@ejemplo.com",
    ]);
  });
});

describe("entrar con Google/Microsoft (findOrCreateOAuthUser)", () => {
  it("crea la cuenta sin contraseña; la primera es fundadora activa", async () => {
    const { findOrCreateOAuthUser } = await import("./users");
    const out = await findOrCreateOAuthUser("adri@gmail.com", "Adrián Carrillo");
    if ("error" in out) throw new Error(out.error);
    expect(out.user.isOwner).toBe(true);
    expect(out.user.subscriptionStatus).toBe("active");
    expect(out.user.displayName).toBe("Adrián Carrillo");
    // Sin contraseña: el login clásico con cualquier clave debe fallar.
    expect(await verifyLogin("adri@gmail.com", "loquesea123")).toBeNull();
  });

  it("si el email ya existe, entra en ESA cuenta (no crea otra)", async () => {
    const reg = await registerUser("adri@gmail.com", "clave-larga-8", "Adrián");
    if ("error" in reg) throw new Error(reg.error);
    const { findOrCreateOAuthUser } = await import("./users");
    const out = await findOrCreateOAuthUser("ADRI@gmail.com", "Otro Nombre");
    if ("error" in out) throw new Error(out.error);
    expect(out.user.id).toBe(reg.user.id);
    expect(out.user.displayName).toBe("Adrián"); // conserva su nombre original
  });

  it("la segunda cuenta OAuth entra en prueba de 14 días", async () => {
    const { findOrCreateOAuthUser } = await import("./users");
    await findOrCreateOAuthUser("primera@gmail.com", "Primera");
    const out = await findOrCreateOAuthUser("segunda@outlook.com", "Segunda");
    if ("error" in out) throw new Error(out.error);
    expect(out.user.isOwner).toBe(false);
    expect(subscriptionOf(out.user)).toMatchObject({ status: "trial", daysLeft: PLAN.trialDays });
  });

  it("sin nombre del proveedor usa la parte local del email", async () => {
    const { findOrCreateOAuthUser } = await import("./users");
    const out = await findOrCreateOAuthUser("dani.perez@gmail.com", "  ");
    if ("error" in out) throw new Error(out.error);
    expect(out.user.displayName).toBe("dani.perez");
  });
});
