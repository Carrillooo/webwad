/**
 * Capturas de ZERO para revisar el diseño. Crea una cuenta y una agenda
 * creíble, y fotografía las pantallas clave en móvil y escritorio.
 * Uso: node scripts/shots.mjs [urlBase] [carpeta]
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3620";
const OUT = process.argv[3] ?? "/tmp/zero-shots";
const EMAIL = `look${Date.now()}@zero.app`;

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
await ctx.request.post(`${BASE}/api/auth/register`, {
  data: { name: "Adrián", email: EMAIL, password: "clave12345", acceptTerms: true },
});
const di = (t) => ctx.request.post(`${BASE}/api/assistant`, { data: { messages: [{ role: "user", content: t }] } });
await di("Añádeme reunión con el equipo hoy a las 10");
await di("Añádeme comida con Laura hoy a las 14 durante hora y media");
await di("Añade preparar presupuesto a mis tareas");

const page = await ctx.newPage();
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/movil-inicio.png` });

await page.locator('[aria-label="Abrir monitor"]').click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/movil-monitor.png` });

await page.locator('button:has-text("Calendario")').click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/movil-calendario.png` });

await page.locator('[aria-label="Configuración"]').click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/movil-ajustes.png` });
await page.keyboard.press("Escape");

await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/escritorio-monitor.png` });

const anon = await browser.newContext({ viewport: { width: 430, height: 932 } });
const login = await anon.newPage();
await login.goto(`${BASE}/`, { waitUntil: "networkidle" });
await login.waitForTimeout(1200);
await login.screenshot({ path: `${OUT}/movil-login.png` });

await browser.close();
console.log("capturas en", OUT);
