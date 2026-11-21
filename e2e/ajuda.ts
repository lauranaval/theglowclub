import { expect, type BrowserContext, type Page } from "@playwright/test";

export const LAURA = "laura@example.test";

/** Entra amb l'accés de prova local i espera que l'app estigui controlada pel service worker i amb dades. */
export async function obreApp(page: Page, email = LAURA): Promise<void> {
  await page.goto(`/dev/entrar?email=${encodeURIComponent(email)}`);
  // «Tot sincronitzat» vol dir que el catàleg i les dades de consulta ja són al dispositiu.
  await expect(page.getByRole("status", { name: "Estat de sincronització" })).toContainText("Tot sincronitzat");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
    }
  });
}

export async function obreCaixa(page: Page, canviEuros = "50"): Promise<void> {
  await page.getByRole("button", { name: "Vendre", exact: true }).click();
  await page.getByLabel("Canvi inicial (€)").fill(canviEuros);
  await page.getByRole("button", { name: "Obrir caixa" }).click();
  await expect(page.getByText(/Caixa oberta/)).toBeVisible();
}

export async function afegeixProducte(page: Page, nom: RegExp): Promise<void> {
  await page.getByRole("button", { name: nom }).first().click();
}

export async function afegeixLliure(page: Page, descripcio: string, euros: string): Promise<void> {
  await page.getByRole("button", { name: "Línia lliure" }).click();
  const dialeg = page.getByRole("dialog", { name: "Línia lliure" });
  await dialeg.getByLabel("Descripció").fill(descripcio);
  await dialeg.getByLabel("Import (€)").fill(euros);
  await dialeg.getByRole("button", { name: "Afegir" }).click();
  await expect(dialeg).toBeHidden();
}

export async function cobra(page: Page, metode: "Efectiu" | "Targeta"): Promise<void> {
  await page.getByRole("region", { name: "Cobrament" }).getByRole("button", { name: metode, exact: true }).click();
  await expect(page.getByRole("region", { name: "Cobrament" })).toBeHidden();
}

export function barraSync(page: Page) {
  return page.getByRole("status", { name: "Estat de sincronització" });
}

export async function dispositiuId(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Més", exact: true }).click();
  const id = (await page.getByTestId("dispositiu").textContent())!.trim();
  await page.getByRole("button", { name: "Vendre", exact: true }).click();
  return id;
}

export async function resumServidor(page: Page, filtre: string) {
  const r = await page.request.get(`/api/resum?${filtre}`);
  expect(r.status()).toBe(200);
  return (await r.json()) as any;
}

export async function senseConnexio(context: BrowserContext, page: Page): Promise<void> {
  await context.setOffline(true);
  await expect(barraSync(page)).toContainText("Sense connexió");
}
