import { expect, test } from "@playwright/test";
import { afegeixLliure, afegeixProducte, barraSync, cobra, dispositiuId, obreApp, obreCaixa, resumServidor } from "./ajuda";

test.describe("Venda ràpida i caixa", () => {
  test("F-03 polsera d'eslabons + charm especial + charm bàsic en efectiu: 17,00 € i desglossament 12 + 3 + 2", async ({ page }) => {
    await obreApp(page);
    await obreCaixa(page);
    await afegeixProducte(page, /Polsera d'eslabons/);
    const tiquet = page.getByRole("list", { name: "Tiquet" });
    await tiquet.getByRole("button", { name: /charm especial/ }).click();
    await tiquet.getByRole("button", { name: /charm bàsic/ }).click();
    await expect(page.getByRole("region", { name: "Cobrament" })).toContainText("17,00 €");
    await cobra(page, "Efectiu");

    await expect(barraSync(page)).toContainText("Tot sincronitzat");
    const id = await dispositiuId(page);
    const resum = await resumServidor(page, `dispositiu=${id}`);
    expect(resum.nombreVendes).toBe(1);
    expect(resum.efectiuCents).toBe(1700);
    expect(resum.vendes[0].linies.map((l: any) => l.preuCents)).toEqual([1200, 300, 200]);

    await page.getByRole("button", { name: "Resum", exact: true }).click();
    const fitxa = page.getByRole("list", { name: "Vendes del dia" });
    await expect(fitxa).toContainText("17,00 €");
    await expect(fitxa).toContainText("Charm extra especial");
    await expect(page.getByTestId("resum-efectiu")).toHaveText("17,00 €");
  });

  test("F-04 collaret de cordill + línia lliure «Peça personalitzada» 8 € amb targeta: una venda de 13,00 € a Targeta", async ({ page }) => {
    await obreApp(page);
    await obreCaixa(page);
    await afegeixProducte(page, /Collaret de cordill/);
    await afegeixLliure(page, "Peça personalitzada", "8");
    await expect(page.getByRole("region", { name: "Cobrament" })).toContainText("13,00 €");
    await cobra(page, "Targeta");

    await expect(barraSync(page)).toContainText("Tot sincronitzat");
    const id = await dispositiuId(page);
    const resum = await resumServidor(page, `dispositiu=${id}`);
    expect(resum.nombreVendes).toBe(1);
    expect(resum.targetaCents).toBe(1300);
    expect(resum.vendes[0].linies).toHaveLength(2);

    await page.getByRole("button", { name: "Resum", exact: true }).click();
    await expect(page.getByTestId("resum-targeta")).toHaveText("13,00 €");
    await expect(page.getByTestId("resum-efectiu")).toHaveText("0,00 €");
  });

  test("F-07 tancament: canvi 50 €, efectiu 120 €, recompte 165 €, targeta i TPV 86 €: esperat 170 €, diferència −5 €", async ({ page }) => {
    await obreApp(page);
    await obreCaixa(page, "50");
    await afegeixLliure(page, "Venda A", "70");
    await cobra(page, "Efectiu");
    await afegeixLliure(page, "Venda B", "50");
    await cobra(page, "Efectiu");
    await afegeixLliure(page, "Venda C", "86");
    await cobra(page, "Targeta");

    await page.getByRole("button", { name: "Caixa", exact: true }).click();
    await page.getByLabel("Recompte d'efectiu (€)").fill("165");
    await page.getByLabel("Total del TPV (€)").fill("86");
    await page.getByLabel("Nota").fill("Falten 5 €");
    await expect(page.getByTestId("efectiu-esperat")).toHaveText("170,00 €");
    await expect(page.getByTestId("diferencia-efectiu")).toHaveText("−5,00 €");
    await expect(page.getByTestId("diferencia-targeta")).toHaveText("0,00 €");
    await page.getByRole("button", { name: "Tancar caixa" }).click();
    await page.getByRole("dialog", { name: "Tancar la caixa" }).getByRole("button", { name: "Sí, tancar" }).click();
    await expect(page.getByText("Caixa tancada")).toBeVisible();
    await expect(page.getByText("Falten 5 €")).toBeVisible();

    await expect(barraSync(page)).toContainText("Tot sincronitzat");
    const id = await dispositiuId(page);
    const resum = await resumServidor(page, `dispositiu=${id}`);
    expect(resum.caixes[0]).toMatchObject({ efectiuEsperatCents: 17000, diferenciaEfectiuCents: -500, diferenciaTargetaCents: 0, nota: "Falten 5 €" });
  });

  test("F-06 anul·lar una venda amb motiu des del resum del dia", async ({ page }) => {
    await obreApp(page);
    await obreCaixa(page);
    await afegeixLliure(page, "Duplicada", "17");
    await cobra(page, "Efectiu");
    await page.getByRole("button", { name: "Resum", exact: true }).click();
    await page.getByRole("button", { name: /Anul·lar/ }).first().click();
    const dialeg = page.getByRole("dialog", { name: "Anul·lar la venda" });
    await dialeg.getByLabel("Motiu").fill("duplicada");
    await dialeg.getByRole("button", { name: "Sí, anul·lar" }).click();
    await expect(page.getByRole("list", { name: "Vendes del dia" })).toContainText("Anul·lada: duplicada");
    await expect(page.getByTestId("resum-net")).toHaveText("0,00 €");
  });
});
