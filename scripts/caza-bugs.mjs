/**
 * Recorre ZERO como lo haría una persona y apunta TODO lo que va mal:
 * errores de consola, peticiones fallidas, textos rotos y controles muertos.
 * Uso: node scripts/caza-bugs.mjs [urlBase]
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3700";
const fallos = [];
const apunta = (donde, que) => fallos.push(`${donde} — ${que}`);

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 2 });

let paso = "arranque";
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error") apunta(paso, `consola: ${m.text().slice(0, 180)}`);
});
page.on("pageerror", (e) => apunta(paso, `excepción: ${String(e).slice(0, 180)}`));
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().includes("favicon")) {
    apunta(paso, `HTTP ${r.status()} en ${r.url().replace(BASE, "")}`);
  }
});

/** Ningún texto visible debe quedar en "undefined", "NaN", "[object Object]"… */
async function textosRotos(donde) {
  const malos = await page.evaluate(() => {
    const out = [];
    const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = it.nextNode())) {
      // Los <script> de Next llevan "null" dentro de su carga útil: no es texto.
      if (n.parentElement?.closest("script, style, template")) continue;
      const t = (n.textContent ?? "").trim();
      if (/\b(undefined|NaN|\[object Object\]|Invalid Date)\b/.test(t)) out.push(t.slice(0, 80));
    }
    return out;
  });
  for (const m of malos) apunta(donde, `texto roto: "${m}"`);
}

/** Nada visible puede salirse del ancho de la pantalla. */
async function desbordes(donde) {
  const malos = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const out = [];
    /** Salirse es normal dentro de algo que se desplaza: eso no es un fallo. */
    const enScroll = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p);
        if (/auto|scroll|hidden/.test(o.overflowX)) return true;
      }
      return false;
    };
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if ((r.right > w + 2 || r.left < -2) && !enScroll(el)) {
        out.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 40)}`);
      }
    }
    return out.slice(0, 5);
  });
  for (const m of malos) apunta(donde, `se sale de la pantalla: ${m}`);
}

/** Todo botón necesita nombre accesible y un área de toque decente. */
async function botonesFlojos(donde) {
  const malos = await page.evaluate(() => {
    const out = [];
    for (const b of document.querySelectorAll("button, a[href]")) {
      const r = b.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const nombre = (b.getAttribute("aria-label") || b.textContent || "").trim();
      if (!nombre) {
        out.push(`sin nombre: ${b.outerHTML.slice(0, 60)}`);
        continue;
      }
      // 44 px es la diana mínima que recomienda Apple para el dedo. Se mide la
      // caja real: un botón bajito con relleno alrededor puede valer igual.
      const alto = Math.max(r.height, parseFloat(getComputedStyle(b).minHeight) || 0);
      if (alto < 40) out.push(`diana baja (${Math.round(r.width)}×${Math.round(alto)}): "${nombre.slice(0, 30)}"`);
    }
    return [...new Set(out)].slice(0, 8);
  });
  for (const m of malos) apunta(donde, m);
}

async function revisa(donde) {
  paso = donde;
  await page.waitForTimeout(600);
  await textosRotos(donde);
  await desbordes(donde);
  await botonesFlojos(donde);
}

// --- Recorrido ------------------------------------------------------------
paso = "portada";
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await revisa("portada");

// Sembrar una agenda para que las vistas tengan contenido.
const di = (t) => ctx.request.post(`${BASE}/api/assistant`, { data: { messages: [{ role: "user", content: t }] } });
await di("Añádeme reunión con el equipo hoy a las 10");
await di("Añádeme comida con Laura hoy a las 14 durante hora y media");
await di("Añade preparar presupuesto a mis tareas");
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

await page.locator('[aria-label="Abrir monitor"]').click();
for (const t of ["Inicio", "Calendario", "Tareas", "Planner", "Docs", "Briefing", "Historial"]) {
  paso = `monitor/${t}`;
  const b = page.locator(`nav button:has-text("${t}")`).first();
  if ((await b.count()) === 0) {
    apunta(paso, "la pestaña no existe o no se alcanza");
    continue;
  }
  await b.scrollIntoViewIfNeeded().catch(() => {});
  await b.click();
  await revisa(paso);
}

// Vistas de semana y mes del calendario.
await page.locator('nav button:has-text("Calendario")').first().click();
await page.waitForTimeout(500);
for (const v of ["Semana", "Mes"]) {
  paso = `calendario/${v}`;
  const b = page.locator(`button:has-text("${v}")`).first();
  if (await b.count()) {
    await b.click();
    await revisa(paso);
  }
}

// Escribir una orden de verdad.
paso = "compositor";
await page.locator('[aria-label="Escribir a ZERO"]').click().catch(() => {});
await page.waitForTimeout(400);
const input = page.locator('[aria-label="Entrada de texto para ZERO"]');
if (await input.count()) {
  await input.fill("¿Qué tengo hoy?");
  await page.locator('[aria-label="Enviar"]').click();
  await page.waitForTimeout(3500);
  await revisa("compositor");
} else {
  apunta(paso, "no se pudo abrir el teclado");
}

// Ajustes de arriba abajo.
paso = "ajustes";
await page.locator('[aria-label="Configuración"]').click();
await page.waitForTimeout(800);
await revisa("ajustes");
const panel = page.locator('section[role="dialog"] div.overflow-y-auto');
if (await panel.count()) {
  await panel.evaluate((e) => (e.scrollTop = e.scrollHeight));
  await revisa("ajustes/final");
}

console.log(fallos.length ? `\n${fallos.length} PROBLEMAS:` : "\nsin problemas");
for (const f of [...new Set(fallos)]) console.log(" ·", f);
await browser.close();
process.exit(0);
