// Construeix la PWA a dist/: app.js i sw.js (esbuild) + fitxers estàtics. La versió del service worker
// és un hash del contingut, així cada canvi de l'app força l'actualització de la memòria cau.
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const arrel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(arrel, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(path.join(arrel, "src", "client", "static"), dist, { recursive: true });

await build({
  entryPoints: [path.join(arrel, "src", "client", "app.ts")],
  bundle: true,
  format: "esm",
  target: "safari15",
  minify: true,
  sourcemap: false,
  outfile: path.join(dist, "app.js"),
});

function fitxers(dir, base = "") {
  return readdirSync(dir).flatMap((nom) => {
    const ple = path.join(dir, nom);
    const rel = `${base}/${nom}`;
    return statSync(ple).isDirectory() ? fitxers(ple, rel) : [rel];
  });
}
const llista = fitxers(dist).filter((f) => f !== "/sw.js");
const hash = createHash("sha256");
for (const f of llista) hash.update(f).update(readFileSync(path.join(dist, f)));
const versio = hash.digest("hex").slice(0, 12);

await build({
  entryPoints: [path.join(arrel, "src", "client", "sw.ts")],
  bundle: true,
  format: "iife",
  target: "safari15",
  minify: true,
  outfile: path.join(dist, "sw.js"),
  define: { __VERSIO__: JSON.stringify(versio), __FITXERS__: JSON.stringify(["/", ...llista]) },
});
writeFileSync(path.join(dist, "versio.txt"), versio + "\n");
console.log(`PWA construïda a dist/ (versió ${versio}, ${llista.length} fitxers)`);
