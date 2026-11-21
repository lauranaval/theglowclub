// Arrenca l'app en local amb Wrangler (sense cap compte de Cloudflare) i l'accés de prova.
// Ús: node scripts/servidor-local.mjs [port] [--proves]
//   --proves: base de dades nova a cada arrencada (.wrangler/proves) i llista d'usuàries de prova, per a Playwright.
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const arrel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.argv.find((a) => /^\d+$/.test(a)) ?? "8787";
const proves = process.argv.includes("--proves");
const persist = path.join(arrel, ".wrangler", proves ? "proves" : "local");
const wrangler = path.join(arrel, "node_modules", "wrangler", "bin", "wrangler.js");
const env = { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" };

function executa(args) {
  const r = spawnSync(process.execPath, args, { cwd: arrel, stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (proves) rmSync(persist, { recursive: true, force: true });
executa([path.join(arrel, "scripts", "build-client.mjs")]);
executa([wrangler, "d1", "migrations", "apply", "glow", "--local", "--persist-to", persist]);
// Dades pròpies de les proves de navegador (només a la base de proves local, mai a producció).
if (proves) executa([wrangler, "d1", "execute", "glow", "--local", "--persist-to", persist, "--file", path.join(arrel, "e2e", "dades-proves.sql")]);

// En mode de proves, el servidor aplica el control d'usuàries com a producció (correus de prova, mai reals).
const usuariesProves = proves ? ["--var", "USUARIES:laura@example.test,elena@example.test,sandra@example.test"] : [];
const fill = spawn(
  process.execPath,
  [wrangler, "dev", "--local", "--ip", "127.0.0.1", "--port", port, "--persist-to", persist, "--var", "DEV_AUTH:1", ...usuariesProves, "--show-interactive-dev-session=false"],
  { cwd: arrel, stdio: "inherit", env },
);
const atura = () => fill.kill();
process.on("SIGINT", atura);
process.on("SIGTERM", atura);
fill.on("exit", (codi) => process.exit(codi ?? 0));
