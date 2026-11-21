// Proves de navegador afegides arran de la revisió independent del bloc 1 (21/11/2026).
import { expect, test } from "@playwright/test";
import { afegeixLliure, barraSync, cobra, dispositiuId, LAURA, obreApp, obreCaixa, resumServidor } from "./ajuda";

// Esdeveniment només de proves: el crea scripts/servidor-local.mjs en mode --proves (e2e/dades-proves.sql). No existeix a producció.
const ESD_PROVES_F12 = "esd-proves-f12";

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
  // Esdeveniment propi de la prova: cap altra prova hi ven, per tant les xifres són exactes.
  for (const pagina of [a, b]) {
    await pagina.getByRole("button", { name: "Vendre", exact: true }).click();
    await pagina.getByLabel("Canvi inicial (€)").fill("0");
    await pagina.getByLabel("Esdeveniment").selectOption(ESD_PROVES_F12);
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
  // Comprovació al servidor, per dispositiu i per esdeveniment.
  const idA = await dispositiuId(a);
  const idB = await dispositiuId(b);
  expect((await resumServidor(a, `esdeveniment=${ESD_PROVES_F12}&dispositiu=${idA}`)).netCents).toBe(4000);
  expect((await resumServidor(a, `esdeveniment=${ESD_PROVES_F12}&dispositiu=${idB}`)).netCents).toBe(2500);

  await a.getByRole("button", { name: "Fira", exact: true }).click();
  const seccio = a.getByRole("region", { name: /Prova F-12/ });
  await expect(seccio.getByTestId("fira-vendes")).toHaveText("5");
  await expect(seccio.getByTestId("fira-net")).toHaveText("65,00 €");
  await expect(seccio.getByTestId("fira-caixes")).toHaveText("2");
  await contextA.close();
  await contextB.close();
});

test("F-15 app oberta per primer cop sense connexió: no es pot obrir caixa i explica que cal connectar-se", async ({ page }) => {
  // Cap petició a l'API arriba: l'app no ha descarregat mai el catàleg ni sap qui és la usuària.
  await page.route("**/api/**", (route) => route.abort("internetdisconnected"));
  await page.goto(`/dev/entrar?email=${encodeURIComponent(LAURA)}`);
  await expect(barraSync(page)).toContainText("Sense connexió");
  await expect(page.getByText(/cal connectar-se un cop/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Obrir caixa" })).toHaveCount(0);
  await expect(page.getByLabel("Canvi inicial (€)")).toHaveCount(0);

  // Quan torna la connexió i es descarreguen les dades, ja es pot obrir la caixa.
  await page.unroute("**/api/**");
  await page.getByRole("button", { name: "Sincronitzar ara" }).click();
  await expect(page.getByRole("button", { name: "Obrir caixa" })).toBeVisible();
});

test("F-17 registres rebutjats per «usuària no permesa»: «Tornar a enviar» els reenvia", async ({ page }) => {
  await obreApp(page);
  const id = await dispositiuId(page);
  let rebutjar = true;
  await page.route("**/api/sync", async (route) => {
    if (!rebutjar) return route.continue();
    const cos = JSON.parse(route.request().postData() ?? "{}");
    const errors = ["usuària no permesa"];
    await route.fulfill({
      json: {
        acceptades: { caixes: [], vendes: [], anulacions: [] },
        rebutjades: [
          ...(cos.caixes ?? []).map((c: any) => ({ tipus: "caixa", id: c.id, errors })),
          ...(cos.vendes ?? []).map((v: any) => ({ tipus: "venda", id: v.id, errors })),
        ],
      },
    });
  });
  await obreCaixa(page);
  await afegeixLliure(page, "Venda rebutjada", "9");
  await cobra(page, "Efectiu");
  await expect(barraSync(page)).toContainText("2 amb errors");

  // Ara el servidor ja accepta la usuària (p. ex. s'ha corregit la llista): la petició real passa.
  rebutjar = false;
  await page.getByRole("button", { name: "Més", exact: true }).click();
  await expect(page.getByText(/usuària no permesa/).first()).toBeVisible();
  await page.getByRole("button", { name: "Tornar a enviar" }).click();
  await expect(barraSync(page)).toContainText("Tot sincronitzat");
  await expect(barraSync(page)).not.toContainText("amb errors");
  const resum = await resumServidor(page, `dispositiu=${id}`);
  expect(resum.nombreVendes).toBe(1);
  expect(resum.netCents).toBe(900);
  expect(resum.caixes).toHaveLength(1);
});

test("F-06 la llista de vendes diu qui ha registrat l'anul·lació si no és la usuària declarada", async ({ page }) => {
  // El servidor diu que l'anul·lació l'ha sincronitzat una altra identitat d'Access.
  await page.route("**/api/resum**", async (route) => {
    const r = await route.fetch();
    const cos = await r.json();
    for (const v of cos.vendes ?? []) if (v.anulacio) v.anulacio.registradaPer = "elena@example.test";
    await route.fulfill({ response: r, json: cos });
  });
  await obreApp(page);
  await obreCaixa(page);
  await afegeixLliure(page, "Venda", "17");
  await cobra(page, "Efectiu");
  await page.getByRole("button", { name: "Resum", exact: true }).click();
  await page.getByRole("button", { name: /Anul·lar/ }).first().click();
  const dialeg = page.getByRole("dialog", { name: "Anul·lar la venda" });
  await dialeg.getByLabel("Motiu").fill("duplicada");
  await dialeg.getByRole("button", { name: "Sí, anul·lar" }).click();
  const llista = page.getByRole("list", { name: "Vendes del dia" });
  await expect(llista).toContainText("Anul·lada: duplicada · laura@example.test");
  await expect(llista).toContainText("registrada per elena@example.test");
});

test("F-01 el servidor de proves aplica la llista d'usuàries: una identitat fora de la llista rep 403", async ({ page }) => {
  await page.goto(`/dev/entrar?email=${encodeURIComponent("intrusa@example.test")}`);
  expect((await page.request.get("/api/dades")).status()).toBe(403);
  await page.goto(`/dev/entrar?email=${encodeURIComponent(LAURA)}`);
  expect((await page.request.get("/api/dades")).status()).toBe(200);
});
