import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  afegeixLliure,
  afegeixProducte,
  barraSync,
  cobra,
  dispositiuId,
  obreApp,
  obreCaixa,
  resumServidor,
  senseConnexio,
} from "./ajuda";

async function fesVendes(page: import("@playwright/test").Page, n: number) {
  for (let i = 0; i < n; i++) {
    await afegeixProducte(page, /Arracades boles/);
    await cobra(page, i % 2 ? "Targeta" : "Efectiu");
  }
}

test.describe("Funcionament sense connexió", () => {
  test("F-15 primera càrrega amb connexió i després sense: obre i permet vendre; té manifest i service worker", async ({ page, context }) => {
    await obreApp(page);
    const manifest = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(manifest).toBeTruthy();
    const r = await page.request.get(manifest!);
    const dades = await r.json();
    expect(dades.display).toBe("standalone");
    expect(dades.icons.some((i: any) => i.sizes === "512x512")).toBe(true);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);

    await context.setOffline(true);
    await page.reload();
    await expect(barraSync(page)).toContainText("Sense connexió");
    await obreCaixa(page);
    await fesVendes(page, 1);
    await expect(barraSync(page)).toContainText("1 venda per sincronitzar");
  });

  test("F-09 30 vendes sense connexió, tancar l'app i tornar-la a obrir: hi són les 30 pendents", async ({ page, context }) => {
    test.setTimeout(120_000);
    await obreApp(page);
    await senseConnexio(context, page);
    await obreCaixa(page);
    await fesVendes(page, 30);
    await expect(barraSync(page)).toContainText("Sense connexió · 30 vendes per sincronitzar");

    await page.close();
    const nova = await context.newPage();
    await nova.goto("/");
    await expect(barraSync(nova)).toContainText("Sense connexió · 30 vendes per sincronitzar");
    await nova.getByRole("button", { name: "Resum", exact: true }).click();
    await expect(nova.getByRole("list", { name: "Vendes del dia" }).getByRole("listitem")).toHaveCount(30);
  });

  test("F-10 torna la connexió amb 30 pendents i es talla després d'arribar-ne 12: al servidor n'hi ha 30, sense duplicats", async ({ page, context }) => {
    test.setTimeout(120_000);
    await obreApp(page);
    const id = await dispositiuId(page);
    await senseConnexio(context, page);
    await obreCaixa(page);
    await fesVendes(page, 30);

    let tallat = false;
    await page.route("**/api/sync", async (route) => {
      if (tallat) return route.continue();
      tallat = true;
      // Arriben 12 vendes al servidor i la connexió es talla abans que el dispositiu rebi la resposta.
      const cos = JSON.parse(route.request().postData()!);
      cos.vendes = cos.vendes.slice(0, 12);
      await route.fetch({ postData: JSON.stringify(cos) });
      await route.abort("connectionreset");
    });
    await context.setOffline(false);
    await expect.poll(() => tallat).toBe(true);
    expect((await resumServidor(page, `dispositiu=${id}`)).nombreVendes).toBe(12);

    await page.getByRole("button", { name: "Sincronitzar ara" }).click();
    await expect(barraSync(page)).toContainText("Tot sincronitzat");
    const resum = await resumServidor(page, `dispositiu=${id}`);
    expect(resum.nombreVendes).toBe(30);
    expect(new Set(resum.vendes.map((v: any) => v.id)).size).toBe(30);
  });

  test("F-11 tancar la caixa sense connexió: calcula la diferència i se sincronitza quan torna la connexió", async ({ page, context }) => {
    await obreApp(page);
    const id = await dispositiuId(page);
    await senseConnexio(context, page);
    await obreCaixa(page, "20");
    await afegeixLliure(page, "Venda", "30");
    await cobra(page, "Efectiu");
    await page.getByRole("button", { name: "Caixa", exact: true }).click();
    await page.getByLabel("Recompte d'efectiu (€)").fill("50");
    await page.getByLabel("Total del TPV (€)").fill("0");
    await expect(page.getByTestId("efectiu-esperat")).toHaveText("50,00 €");
    await expect(page.getByTestId("diferencia-efectiu")).toHaveText("0,00 €");
    await page.getByRole("button", { name: "Tancar caixa" }).click();
    await page.getByRole("dialog", { name: "Tancar la caixa" }).getByRole("button", { name: "Sí, tancar" }).click();
    await expect(page.getByText("Caixa tancada")).toBeVisible();

    await context.setOffline(false);
    await expect(barraSync(page)).toContainText("Tot sincronitzat");
    const resum = await resumServidor(page, `dispositiu=${id}`);
    expect(resum.caixes[0]).toMatchObject({ recompteEfectiuCents: 5000, diferenciaEfectiuCents: 0 });
  });

  test("F-16 la sessió ha caducat amb vendes pendents: demana tornar a entrar i no en perd cap", async ({ page, context }) => {
    await obreApp(page);
    const id = await dispositiuId(page);
    await senseConnexio(context, page);
    await obreCaixa(page);
    await fesVendes(page, 2);
    await context.clearCookies();
    await context.setOffline(false);
    await expect(page.getByRole("alert")).toContainText("La sessió ha caducat");
    await expect(barraSync(page)).toContainText("2 vendes per sincronitzar");

    await page.getByRole("button", { name: "Torna a entrar" }).click();
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(barraSync(page)).toContainText("Tot sincronitzat");
    expect((await resumServidor(page, `dispositiu=${id}`)).nombreVendes).toBe(2);
  });

  test("F-17 descarregar còpia d'emergència amb 5 vendes pendents", async ({ page, context }) => {
    await obreApp(page);
    await senseConnexio(context, page);
    await obreCaixa(page);
    await fesVendes(page, 5);
    await page.getByRole("button", { name: "Més", exact: true }).click();
    const [baixada] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Descarregar còpia d'emergència" }).click(),
    ]);
    expect(baixada.suggestedFilename()).toMatch(/^glow-vendes-pendents-.*\.json$/);
    const copia = JSON.parse(await readFile((await baixada.path())!, "utf8"));
    expect(copia.vendes).toHaveLength(5);
    expect(copia.vendes.map((v: any) => v.totalCents)).toEqual([600, 600, 600, 600, 600]);
  });
});
