// Executa una ordre amb torn exclusiu: si una altra execució de proves de navegador (porta ODD o un agent)
// ja està en marxa, s'espera que acabi. Comparteixen port, dist/ i base de dades de proves.
// Ús: node scripts/amb-torn.mjs "<ordre>"
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const arrel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const torn = path.join(arrel, ".wrangler", "torn-proves");
const ordre = process.argv.slice(2).join(" ");
const ESPERA_MAX_MS = 15 * 60 * 1000;
const CADUCAT_MS = 20 * 60 * 1000; // un torn més vell que això és d'una execució que va morir

mkdirSync(path.dirname(torn), { recursive: true });
const inici = Date.now();
let avisat = false;
for (;;) {
  try {
    mkdirSync(torn); // atòmic: només un procés el pot crear
    writeFileSync(path.join(torn, "pid"), String(process.pid));
    break;
  } catch {
    try {
      if (Date.now() - statSync(torn).mtimeMs > CADUCAT_MS) {
        rmSync(torn, { recursive: true, force: true });
        continue;
      }
    } catch {
      continue;
    }
    if (Date.now() - inici > ESPERA_MAX_MS) {
      console.error("Proves: fa massa estona que una altra execució ocupa el torn.");
      process.exit(1);
    }
    if (!avisat) {
      console.error("Proves: hi ha una altra execució de proves de navegador en marxa; s'espera el torn…");
      avisat = true;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }
}

const allibera = () => rmSync(torn, { recursive: true, force: true });
process.on("SIGINT", () => {
  allibera();
  process.exit(130);
});
const r = spawnSync(ordre, { cwd: arrel, stdio: "inherit", shell: true });
allibera();
process.exit(r.status ?? 1);
