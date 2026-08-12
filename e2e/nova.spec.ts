import { test, expect } from "@playwright/test";

test.describe("NOVA — MVP demo flow", () => {
  test("carga en modo demo con el núcleo y el saludo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Señor Carrillo/)).toBeVisible();
    await expect(page.getByText("DEMO")).toBeVisible();
    await expect(page.getByRole("button", { name: /Hablar con NOVA|NOVA activa/ })).toBeVisible();
  });

  test("consultar agenda de mañana abre el calendario", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("textbox", { name: /Entrada de texto para NOVA/ });
    await input.fill("¿qué tengo mañana?");
    await input.press("Enter");
    // El monitor cambia a la vista de calendario.
    await expect(page.getByText(/eventos/)).toBeVisible({ timeout: 8000 });
  });

  test("crear un evento sin conflicto muestra confirmación", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("textbox", { name: /Entrada de texto para NOVA/ });
    await input.fill("añádeme repaso mañana a las 15:00 durante una hora");
    await input.press("Enter");
    // El evento se crea y aparece en el timeline del calendario (puede requerir
    // scroll: comprobamos que está en el DOM).
    await expect(page.getByText("Repaso").first()).toBeAttached({ timeout: 8000 });
  });

  test("entrada por teclado disponible (fallback de voz)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("textbox", { name: /Entrada de texto para NOVA/ })).toBeVisible();
  });
});
