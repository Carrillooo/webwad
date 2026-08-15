/**
 * Graba un vídeo de demostración de ZERO manejando la app de verdad.
 * Uso: node scripts/demo-video.mjs [urlBase] [carpetaSalida]
 *
 * No es un montaje: es la aplicación real respondiendo. Sale sin audio (la
 * locución y la música se ponen después en cualquier editor).
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3500";
const OUT = process.argv[3] ?? "/tmp/zero-video";
const EMAIL = `demo${Date.now()}@zero.app`;

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({
  viewport: { width: 540, height: 1170 },
  recordVideo: { dir: OUT, size: { width: 540, height: 1170 } },
});

// --- Preparar la cuenta y una agenda creíble ANTES de grabar ---------------
await ctx.request.post(`${BASE}/api/auth/register`, {
  data: { name: "Adrián", email: EMAIL, password: "clave12345", acceptTerms: true },
});
const di = (t) => ctx.request.post(`${BASE}/api/assistant`, { data: { messages: [{ role: "user", content: t }] } });
await di("Añádeme reunión con el equipo hoy a las 10");
await di("Añádeme comida con Laura hoy a las 14 durante hora y media");
await di("Añádeme entrenamiento hoy a las 19:30");
await di("Añade preparar presupuesto a mis tareas");
await di("Añade llamar al proveedor a mis tareas");

const page = await ctx.newPage();
const t0 = Date.now();
const beats = [];
/** Apunta en qué segundo empieza cada escena (para los rótulos). */
function marca(texto) {
  beats.push({ at: (Date.now() - t0) / 1000, texto });
}

/** Marca visible del toque: en vídeo no se ve el ratón. */
async function tap(selector) {
  const el = page.locator(selector).first();
  const box = await el.boundingBox();
  if (box) {
    await page.evaluate(([x, y]) => {
      const d = document.createElement("div");
      d.style.cssText = `position:fixed;left:${x - 26}px;top:${y - 26}px;width:52px;height:52px;border-radius:50%;
        background:rgba(225,6,0,.28);border:2px solid rgba(225,6,0,.75);z-index:99999;pointer-events:none;
        transition:transform .45s ease-out,opacity .45s ease-out`;
      document.body.appendChild(d);
      requestAnimationFrame(() => {
        d.style.transform = "scale(1.7)";
        d.style.opacity = "0";
      });
      setTimeout(() => d.remove(), 500);
    }, [box.x + box.width / 2, box.y + box.height / 2]);
    await page.waitForTimeout(230);
  }
  await el.click();
}

/** La insignia DEMO no cuenta nada bueno a un cliente. */
const limpia = () =>
  page.evaluate(() => {
    document.querySelectorAll("button").forEach((b) => b.textContent?.includes("DEMO") && b.remove());
  });

async function pedir(texto) {
  // El botón del teclado solo existe si el compositor está cerrado.
  const abrir = page.locator('[aria-label="Escribir a ZERO"]');
  if (await abrir.count()) {
    await tap('[aria-label="Escribir a ZERO"]');
    await page.waitForTimeout(400);
  }
  await page.locator('[aria-label="Entrada de texto para ZERO"]').type(texto, { delay: 55 });
  await page.waitForTimeout(500);
  await tap('[aria-label="Enviar"]');
}

// --- Guion ----------------------------------------------------------------
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await limpia();
marca("ZERO · tu asistente personal, por voz y en español");
await page.waitForTimeout(2200); // 1. saludo + la piedra

await tap('[aria-label="Abrir monitor"]');
marca("Tu día, de un vistazo");
await page.waitForTimeout(2600); // 2. tarjetas del día y atajos

await tap('button:has-text("¿Qué tengo hoy?")');
marca("Pregúntale como a una persona");
await page.waitForTimeout(4200); // 3. responde y abre el calendario
await limpia();

marca("Dile lo que necesitas, en lenguaje normal");
await pedir("Apúntame el dentista el jueves a las 17:30");
await page.waitForTimeout(4200); // 4. lo crea y lo confirma
await limpia();

await tap('button:has-text("Calendario")');
marca("Y aparece en tu calendario de verdad");
await page.waitForTimeout(3600); // 5. el día, con todo dentro

marca("Encuentra tus huecos libres");
await pedir("¿Qué huecos tengo mañana?");
await page.waitForTimeout(4200); // 6. huecos libres

await tap('button:has-text("Tareas")');
marca("Tus tareas, siempre a mano");
await page.waitForTimeout(3000); // 7. tareas reales

await tap('button:has-text("Historial")');
await page.waitForTimeout(1600);
await page.locator("button[aria-expanded]").first().click().catch(() => {});
marca("Y recuerda todo lo que le has pedido");
await page.waitForTimeout(3400); // 8. queda todo lo hablado

await limpia();
// Cierre sobre el calendario lleno: la pantalla de inicio, a última hora del
// día, sale vacía y no vende nada.
await tap('button:has-text("Calendario")');
await page.waitForTimeout(700);
// "Huecos mañana" dejó el calendario en el día siguiente: volver a hoy, que
// es el día que tiene la agenda llena.
await page.locator('button:has-text("Hoy")').first().click().catch(() => {});
marca("ZERO Pro · 20 €/mes · 14 días gratis");
await page.waitForTimeout(3000); // 9. cierre tranquilo

await page.close();
await ctx.close();
await browser.close();
const fs = await import("node:fs");
fs.writeFileSync(`${OUT}/beats.json`, JSON.stringify(beats, null, 2));
console.log("vídeo en", OUT);
