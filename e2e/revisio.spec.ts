// Proves de navegador afegides arran de la revisió independent del bloc 1 (21/11/2026).
import { expect, test } from "@playwright/test";
import { afegeixLliure, barraSync, cobra, dispositiuId, obreApp, obreCaixa, resumServidor } from "./ajuda";

test("F-11 tancar la caixa mentre s'envia la versió oberta no perd el tancament", async ({ page }) => {
  await obreApp(page);
  const id = await dispositiuId(page);

  let alliberar!: () => void;
  const retinguda = new Promise<void>((r) => (alliberar = r));
  let retenint = true;
  let peticioRetinguda = false;
  await page.route("**/api/sync", async (route) => {
    const cos = JSON.parse(route.request().postData() ?? "{}");
    if (retenint && cos.caixes?.some((c: any) => c.tancadaA == null)) {
      retenint = false;
      peticioRetinguda = true;
      await retinguda;
    }
    await route.continue();
  });

  await obreCaixa(page, "20");
  await expect.poll(() => peticioRetinguda).toBe(true);
  await page.getByRole("button", { name: "Caixa", exact: true }).click();
  await page.getByLabel("Recompte d'efectiu (€)").fill("20");
  await page.getByLabel("Total del TPV (€)").fill("0");
  await page.getByRole("button", { name: "Tancar caixa" }).click();
  await page.getByRole("dialog", { name: "Tancar la caixa" }).getByRole("button", { name: "Sí, tancar" }).click();
  await expect(page.getByText("Caixa tancada")).toBeVisible();
  alliberar();

  await expect(barraSync(page)).toContainText("Tot sincronitzat");
  await expect.poll(async () => (await resumServidor(page, `dispositiu=${id}`)).caixes[0]?.recompteEfectiuCents ?? null).toBe(2000);
});

test("F-06 l'anul·lació d'una venda rebutjada pel servidor no queda pendent per sempre", async ({ page }) => {
  await obreApp(page);
  await page.route("**/api/sync", async (route) => {
    const cos = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({
      json: {
        acceptades: { caixes: (cos.caixes ?? []).map((c: any) => c.id), vendes: [], anulacions: [] },
        rebutjades: (cos.vendes ?? []).map((v: any) => ({ tipus: "venda", id: v.id, errors: ["rebutjada a la prova"] })),
      },
    });
  });
  await obreCaixa(page);
  await afegeixLliure(page, "Venda rebutjada", "17");
  await cobra(page, "Efectiu");
  await expect(barraSync(page)).toContainText("amb errors");

  await page.getByRole("button", { name: "Resum", exact: true }).click();
  await page.getByRole("button", { name: /Anul·lar/ }).first().click();
  const dialeg = page.getByRole("dialog", { name: "Anul·lar la venda" });
  await dialeg.getByLabel("Motiu").fill("duplicada");
  await dialeg.getByRole("button", { name: "Sí, anul·lar" }).click();
  await expect(page.getByRole("list", { name: "Vendes del dia" })).toContainText("Anul·lada: duplicada");

  await page.getByRole("button", { name: "Sincronitzar ara" }).click();
  await expect(barraSync(page)).toContainText("2 amb errors");
  await expect(barraSync(page)).not.toContainText("per sincronitzar");
});

test("F-12 la pantalla Fira suma les caixes de dos dispositius de l'esdeveniment", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  await obreApp(a, "laura@example.test");
  await obreApp(b, "sandra@example.test");
  // Abans d'obrir cap caixa: el que ja hi havia al servidor (la base de proves es comparteix entre proves).
  const abans = (await (await a.request.get("/api/esdeveniments/fira-nadal-llavaneres-2026")).json()).caixa;
  for (const pagina of [a, b]) {
    await pagina.getByRole("button", { name: "Vendre", exact: true }).click();
    await pagina.getByLabel("Canvi inicial (€)").fill("0");
    await pagina.getByLabel("Esdeveniment").selectOption("fira-nadal-llavaneres-2026");
    await pagina.getByRole("button", { name: "Obrir caixa" }).click();
  }
  for (const euros of ["15", "15", "10"]) {
    await afegeixLliure(a, "Venda A", euros);
    await cobra(a, "Efectiu");
  }
  for (const euros of ["12", "13"]) {
    await afegeixLliure(b, "Venda B", euros);
    await cobra(b, "Targeta");
  }
  await expect(barraSync(a)).toContainText("Tot sincronitzat");
  await expect(barraSync(b)).toContainText("Tot sincronitzat");

  await a.getByRole("button", { name: "Fira", exact: true }).click();
  // La base de proves es comparteix entre proves: comptem el que s'hi afegeix (5 vendes, 65 €, 2 caixes).
  const euros = (c: number) => `${Math.floor(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${String(c % 100).padStart(2, "0")} €`;
  await expect(a.getByTestId("fira-vendes")).toHaveText(String(abans.nombreVendes + 5));
  await expect(a.getByTestId("fira-net")).toHaveText(euros(abans.netCents + 6500));
  await expect(a.getByTestId("fira-caixes")).toHaveText(String(abans.nombreCaixes + 2));
  await contextA.close();
  await contextB.close();
});
