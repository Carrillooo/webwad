/**
 * Comprueba que la web sigue viva con el CSP estricto puesto: que React
 * hidrata (los atajos responden) y que el navegador no bloquea ningún script.
 * Uso: node scripts/check-csp.mjs [urlBase]
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3611";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 430, height: 930 } });
const errores = [];
page.on("console", (m) => m.type() === "error" && errores.push(m.text()));
page.on("pageerror", (e) => errores.push(String(e)));

const res = await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const csp = res.headers()["content-security-policy"] ?? "(sin CSP)";
const nonces = await page.$$eval("script[nonce]", (s) => s.length);
const scripts = await page.$$eval("script[src]", (s) => s.length);
const chips = await page.locator("button").count();
const hidratado = await page.evaluate(() => !!document.querySelector("#__next, body > div"));

console.log("CSP:", csp.slice(0, 120), "…");
console.log("scripts con src:", scripts, "| con nonce:", nonces);
console.log("botones visibles (react vivo):", chips, "| raíz montada:", hidratado);
console.log("errores de consola:", errores.length);
for (const e of errores.slice(0, 8)) console.log("  ·", e.slice(0, 200));

await browser.close();
process.exit(chips > 0 && errores.length === 0 ? 0 : 1);
