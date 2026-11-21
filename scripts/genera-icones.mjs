// Genera les icones PNG de la PWA a partir de src/client/static/icones/icona.svg (s'executa a mà, un cop).
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const svg = readFileSync("src/client/static/icones/icona.svg", "utf8");
const navegador = await chromium.launch();
const pagina = await navegador.newPage();
for (const [nom, mida] of [["icona-192.png", 192], ["icona-512.png", 512], ["apple-touch-icon.png", 180]]) {
  await pagina.setViewportSize({ width: mida, height: mida });
  await pagina.setContent(`<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${mida}" height="${mida}" `)}</body></html>`);
  await pagina.screenshot({ path: `src/client/static/icones/${nom}`, omitBackground: true });
}
await navegador.close();
console.log("Icones generades");
