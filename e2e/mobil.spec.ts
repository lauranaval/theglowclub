import { expect, test } from "@playwright/test";
import { afegeixProducte, cobra, obreApp, obreCaixa } from "./ajuda";

// S'executa als dos projectes: mòbil (390 px) i iPad (820 px).
test("F-14 venda de F-03 sense desplaçament horitzontal, cobrament sempre visible i botons ≥ 44 px", async ({ page }) => {
  await obreApp(page);
  await obreCaixa(page);
  for (let i = 0; i < 4; i++) await afegeixProducte(page, /Polsera d'eslabons/);
  const tiquet = page.getByRole("list", { name: "Tiquet" });
  await tiquet.getByRole("button", { name: /charm especial/ }).first().click();
  await tiquet.getByRole("button", { name: /charm bàsic/ }).first().click();

  const cobrament = page.getByRole("region", { name: "Cobrament" });
  await page.mouse.wheel(0, 2000);
  await expect(cobrament).toBeInViewport({ ratio: 1 });
  await page.mouse.wheel(0, -4000);
  await expect(cobrament).toBeInViewport({ ratio: 1 });

  const desbordament = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desbordament).toBeLessThanOrEqual(0);

  const petits = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea")]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ text: (el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 40), r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 44 || r.width < 44)
      .map(({ text, r }) => `${text} (${Math.round(r.width)}×${Math.round(r.height)})`),
  );
  expect(petits).toEqual([]);

  const fontsPetites = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("input, select, textarea")]
      .filter((el) => el.offsetParent !== null && parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => el.getAttribute("aria-label") || el.id),
  );
  expect(fontsPetites).toEqual([]);

  await cobra(page, "Efectiu");
});
