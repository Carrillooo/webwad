/**
 * Revisión en móvil de verdad: iPhone alto, con y sin agenda, y simulando el
 * hueco del notch (que es lo que descolocaba la capa de reposo).
 * Uso: node scripts/shots-movil.mjs [urlBase] [carpeta]
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3630";
const OUT = process.argv[3] ?? "/tmp/zero-movil";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});

/** Chromium de escritorio no aplica safe-area: se imita con relleno. */
const NOTCH = `body { padding-top: 59px !important; padding-bottom: 34px !important; }`;

async function mira(nombre, { agenda, notch }) {
  const ctx = await browser.newContext({
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.request.post(`${BASE}/api/auth/register`, {
    data: { name: "Adrián", email: `m${Date.now()}@zero.app`, password: "clave12345", acceptTerms: true },
  });
  if (agenda) {
    const di = (t) => ctx.request.post(`${BASE}/api/assistant`, { data: { messages: [{ role: "user", content: t }] } });
    await di("Añádeme reunión con el equipo hoy a las 10");
    await di("Añade preparar presupuesto a mis tareas");
  }
  const page = await ctx.newPage();
  if (notch) await page.addInitScript((css) => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = css;
      document.head.appendChild(s);
    });
  }, NOTCH);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/${nombre}.png` });

  // Comprobación dura: nada de la capa de reposo puede pisar ni la cabecera
  // ni la piedra.
  const solapes = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const fecha = q("header p")?.getBoundingClientRect();
    const chips = [...document.querySelectorAll('[aria-label="Cosas que puedes pedirle"] button')].map((b) =>
      b.getBoundingClientRect(),
    );
    const resumen = q('header')?.parentElement?.nextElementSibling?.querySelector("button")?.getBoundingClientRect();
    const piedra = q(".crystal-button")?.getBoundingClientRect();
    const pisa = (a, b) => !!a && !!b && a.top < b.bottom && b.top < a.bottom && a.left < b.right && b.left < a.right;
    return {
      resumenSobreFecha: pisa(resumen, fecha),
      chipsSobrePiedra: chips.some((c) => pisa(c, piedra)),
      resumenTop: resumen?.top ?? null,
      fechaBottom: fecha?.bottom ?? null,
      piedraTop: piedra?.top ?? null,
      chipsBottom: chips.length ? Math.max(...chips.map((c) => c.bottom)) : null,
    };
  });
  console.log(nombre, JSON.stringify(solapes));
  await ctx.close();
  return solapes;
}

const r = [];
r.push(await mira("movil-con-agenda", { agenda: true, notch: true }));
r.push(await mira("movil-sin-agenda", { agenda: false, notch: true }));
r.push(await mira("movil-sin-notch", { agenda: true, notch: false }));

await browser.close();
const malo = r.some((x) => x.resumenSobreFecha || x.chipsSobrePiedra);
console.log(malo ? "HAY SOLAPES" : "sin solapes");
process.exit(malo ? 1 : 0);
