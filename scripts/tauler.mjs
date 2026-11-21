#!/usr/bin/env node
// Tauler de control de The Glow Club: genera tauler/index.html (pàgina autònoma) i actualitza tauler/historial.json.
// Fonts: outcomes/*.md, resultats de proves (tauler/.resultats/*.json), git log i transcripcions locals de Claude Code.
// Ús: node scripts/tauler.mjs [--silenci]   (--silenci: sense sortida i mai no falla; per al hook Stop)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SILENCI = process.argv.includes("--silenci");
const ARREL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ARREL, "tauler");
const ZONA = "Europe/Madrid";

const CONFIG_PER_DEFECTE = {
  dataFira: "2026-12-05",
  carpetaTranscripcions: "c--Users-laura-naval-Claude-Projects-The-Glow-Club",
  blocs: [
    { num: 1, nom: "Fira", pes: 25 },
    { num: 2, nom: "Tallers i reserves", pes: 25 },
    { num: 3, nom: "Contactes", pes: 15 },
    { num: 4, nom: "Economia", pes: 15 },
    { num: 5, nom: "Tasques, calendari i Excel", pes: 10 },
    { num: 6, nom: "Traspàs de Notion", pes: 10 },
  ],
  // Preus de l'API d'Anthropic en dòlars per milió de tokens (documentació oficial, consultada el 21/11/2026).
  // Escriure a la memòria cau costa 1,25 vegades l'entrada (5 minuts) o 2 vegades (1 hora).
  preus: {
    font: "Preus públics de l'API d'Anthropic (consultats el 21/11/2026)",
    perDefecte: "claude-opus-5-5",
    models: {
      "claude-opus-5-5": { entrada: 4, sortida: 20, lecturaCau: 0.2 },
      "claude-opus-5": { entrada: 5, sortida: 25, lecturaCau: 0.5 },
      "claude-fable-5-2": { entrada: 8, sortida: 40, lecturaCau: 0.2 },
      "claude-sonnet-5-5": { entrada: 2, sortida: 10, lecturaCau: 0.1 },
      "claude-sonnet-5": { entrada: 2, sortida: 10, lecturaCau: 0.2 },
      "claude-haiku-5-5": { entrada: 0.1, sortida: 0.5, lecturaCau: 0.01 },
    },
  },
};

function llegeixJson(fitxer, perDefecte) {
  try {
    return JSON.parse(readFileSync(fitxer, "utf8"));
  } catch {
    return perDefecte;
  }
}

const diaMadrid = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const horaMadrid = (d) => new Intl.DateTimeFormat("ca-ES", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" }).format(d);
const dataCat = (dia) => dia.split("-").reverse().join("/");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (n) => new Intl.NumberFormat("ca-ES").format(Math.round(n));
const compacte = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".", ",")} M` : n >= 1e3 ? `${Math.round(n / 1e3)} k` : String(n));

// ---------- Resultats de proves ----------

function provesVitest() {
  const j = llegeixJson(path.join(DIR, ".resultats", "vitest.json"), null);
  if (!j) return { proves: [], data: null };
  const proves = (j.testResults ?? []).flatMap((f) =>
    (f.assertionResults ?? []).map((a) => ({ eina: "Vitest", titol: a.title, ok: a.status === "passed", omesa: a.status === "skipped" || a.status === "pending" })),
  );
  return { proves, data: j.startTime ? new Date(j.startTime) : null };
}

function provesPlaywright() {
  const j = llegeixJson(path.join(DIR, ".resultats", "playwright.json"), null);
  if (!j) return { proves: [], data: null };
  const proves = [];
  const recorre = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        proves.push({
          eina: `Playwright${t.projectName ? ` (${t.projectName})` : ""}`,
          titol: spec.title,
          ok: t.status === "expected" || t.status === "flaky",
          omesa: t.status === "skipped",
        });
      }
    }
    (suite.suites ?? []).forEach(recorre);
  };
  (j.suites ?? []).forEach(recorre);
  return { proves, data: j.stats?.startTime ? new Date(j.stats.startTime) : null };
}

// ---------- Resultats (outcomes) ----------

function llegeixOutcomes(proves) {
  const dir = path.join(ARREL, "outcomes");
  if (!existsSync(dir)) return {};
  const perBloc = {};
  for (const fitxer of readdirSync(dir).filter((f) => /^\d{2}-.*\.md$/.test(f)).sort()) {
    const blocNum = Number(fitxer.slice(0, 2));
    const text = readFileSync(path.join(dir, fitxer), "utf8");
    const titol = (text.match(/^#\s+(.+)$/m) ?? [])[1] ?? fitxer;
    const estatFitxer = (text.match(/^Estat:\s*(.+)$/m) ?? [])[1] ?? "";
    const resultats = [];
    for (const linia of text.split(/\r?\n/)) {
      const m = /^\|\s*(?:[✅❌]\s*)?([A-Z]{1,3}-\d{2,3})\s*(?:[✅❌]\s*)?\|/.exec(linia);
      if (!m) continue;
      const cel = linia.split("|").slice(1, -1).map((c) => c.trim());
      const id = m[1];
      const cas = cel[1] ?? "";
      const comprova = cel[3] ?? "";
      const lesProves = proves.filter((p) => !p.omesa && new RegExp(`\\b${id}\\b`).test(p.titol));
      // Si el resultat demana Vitest i Playwright, han d'existir proves de totes dues eines.
      const falten = ["Vitest", "Playwright"].filter((eina) => comprova.includes(eina) && !lesProves.some((p) => p.eina.startsWith(eina)));
      let estat;
      if (linia.includes("✅")) estat = "verificat";
      else if (linia.includes("❌")) estat = "fallat";
      else if (lesProves.some((p) => !p.ok)) estat = "vermell";
      else if (lesProves.length && falten.length === 0) estat = "verd";
      else if (lesProves.some((p) => !p.ok)) estat = "vermell";
      else if (/manual/i.test(comprova)) estat = "manual";
      else estat = "pendent";
      resultats.push({ id, cas, comprova, estat, proves: lesProves.length, provesOk: lesProves.filter((p) => p.ok).length });
    }
    perBloc[blocNum] = { fitxer, titol, estatFitxer, resultats };
  }
  return perBloc;
}

// ---------- Git ----------

function commits() {
  try {
    const sortida = execFileSync("git", ["log", "--branches", "--format=%H%x1f%aI%x1f%an%x1f%s", "--no-merges"], {
      cwd: ARREL,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return sortida
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        const [hash, data, autor, missatge] = l.split("\x1f");
        const d = new Date(data);
        return { hash: hash.slice(0, 7), dia: diaMadrid(d), hora: horaMadrid(d), autor, missatge };
      });
  } catch {
    return [];
  }
}

function brancaActual() {
  try {
    return execFileSync("git", ["branch", "--show-current"], { cwd: ARREL, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

// ---------- Tokens (transcripcions locals de Claude Code) ----------

function fitxersJsonl(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((nom) => {
    const ple = path.join(dir, nom);
    if (nom === "memory") return [];
    const s = statSync(ple);
    return s.isDirectory() ? fitxersJsonl(ple) : nom.endsWith(".jsonl") ? [ple] : [];
  });
}

function tokens(carpeta, preusConfig) {
  const dir = path.join(os.homedir(), ".claude", "projects", carpeta);
  const vistos = new Set();
  const perDia = {};
  const perSessio = {};
  const total = { entrada: 0, sortida: 0, cacheEscrita: 0, cacheLlegida: 0, missatges: 0, cost: 0 };
  const preus = preusConfig.models;
  const modelsSensePreu = new Set();
  for (const fitxer of fitxersJsonl(dir)) {
    let contingut;
    try {
      contingut = readFileSync(fitxer, "utf8");
    } catch {
      continue;
    }
    for (const linia of contingut.split("\n")) {
      if (!linia.includes('"usage"')) continue;
      let r;
      try {
        r = JSON.parse(linia);
      } catch {
        continue;
      }
      const u = r?.message?.usage;
      const id = r?.message?.id;
      if (r.type !== "assistant" || !u || !id || vistos.has(id)) continue;
      vistos.add(id);
      const dia = diaMadrid(new Date(r.timestamp ?? Date.now()));
      const sessio = r.sessionId ?? path.basename(fitxer, ".jsonl");
      const x = {
        entrada: u.input_tokens ?? 0,
        sortida: u.output_tokens ?? 0,
        cacheEscrita: u.cache_creation_input_tokens ?? 0,
        cacheLlegida: u.cache_read_input_tokens ?? 0,
      };
      // Cost equivalent a preu d'API, en dòlars.
      const model = r.message.model;
      let preu = preus[model];
      if (!preu) {
        if (model && !model.startsWith("<")) modelsSensePreu.add(model);
        preu = preus[preusConfig.perDefecte];
      }
      const cc = u.cache_creation ?? {};
      const cau1h = cc.ephemeral_1h_input_tokens ?? 0;
      const cau5m = cc.ephemeral_5m_input_tokens ?? Math.max(0, x.cacheEscrita - cau1h);
      x.cost =
        (x.entrada * preu.entrada + x.sortida * preu.sortida + cau5m * preu.entrada * 1.25 + cau1h * preu.entrada * 2 + x.cacheLlegida * preu.lecturaCau) / 1e6;
      for (const [desti, clau] of [
        [perDia, dia],
        [perSessio, sessio],
      ]) {
        desti[clau] ??= { entrada: 0, sortida: 0, cacheEscrita: 0, cacheLlegida: 0, missatges: 0, cost: 0, inici: r.timestamp, fi: r.timestamp };
        const d = desti[clau];
        for (const k of Object.keys(x)) d[k] += x[k];
        d.missatges++;
        if (r.timestamp && r.timestamp < d.inici) d.inici = r.timestamp;
        if (r.timestamp && r.timestamp > d.fi) d.fi = r.timestamp;
      }
      for (const k of Object.keys(x)) total[k] += x[k];
      total.missatges++;
    }
  }
  const suma = (t) => t.entrada + t.sortida + t.cacheEscrita + t.cacheLlegida;
  return { perDia, perSessio, total, suma, modelsSensePreu: [...modelsSensePreu] };
}

// ---------- Càlculs ----------

function calcula() {
  const config = { ...CONFIG_PER_DEFECTE, ...llegeixJson(path.join(DIR, "config.json"), {}) };
  const vt = provesVitest();
  const pw = provesPlaywright();
  const proves = [...vt.proves, ...pw.proves];
  const outcomes = llegeixOutcomes(proves);
  const pesTotal = config.blocs.reduce((s, b) => s + b.pes, 0) || 1;
  const blocs = config.blocs.map((b) => {
    const o = outcomes[b.num];
    const res = o?.resultats ?? [];
    const fets = res.filter((r) => r.estat === "verd" || r.estat === "verificat").length;
    const percent = res.length ? (fets / res.length) * 100 : 0;
    return { ...b, outcomes: o ?? null, total: res.length, fets, percent };
  });
  const global = blocs.reduce((s, b) => s + (b.percent * b.pes) / pesTotal, 0);
  const cs = commits();
  const tk = tokens(config.carpetaTranscripcions, { ...CONFIG_PER_DEFECTE.preus, ...(config.preus ?? {}) });
  const ara = new Date();
  const avui = diaMadrid(ara);
  const diesFira = Math.round((Date.parse(`${config.dataFira}T00:00:00Z`) - Date.parse(`${avui}T00:00:00Z`)) / 86400000);
  return { config, blocs, global, proves, vt, pw, commits: cs, tokens: tk, ara, avui, diesFira, branca: brancaActual() };
}

function actualitzaHistorial(d) {
  const fitxer = path.join(DIR, "historial.json");
  const historial = llegeixJson(fitxer, []);
  const totsResultats = d.blocs.flatMap((b) => b.outcomes?.resultats ?? []);
  const entrada = {
    data: d.avui,
    percentGlobal: Math.round(d.global * 10) / 10,
    percentPerBloc: Object.fromEntries(d.blocs.map((b) => [b.num, Math.round(b.percent * 10) / 10])),
    resultatsFets: totsResultats.filter((r) => r.estat === "verd" || r.estat === "verificat").length,
    resultatsTotals: totsResultats.length,
    tokensDia: d.tokens.perDia[d.avui] ? d.tokens.suma(d.tokens.perDia[d.avui]) : 0,
    tokensSortidaDia: d.tokens.perDia[d.avui]?.sortida ?? 0,
    costDia: Math.round((d.tokens.perDia[d.avui]?.cost ?? 0) * 100) / 100,
    commitsDia: d.commits.filter((c) => c.dia === d.avui).length,
    actualitzatA: d.ara.toISOString(),
  };
  const i = historial.findIndex((h) => h.data === d.avui);
  if (i >= 0) historial[i] = entrada;
  else historial.push(entrada);
  historial.sort((a, b) => a.data.localeCompare(b.data));
  // Els tokens d'un dia passat es poden recalcular des de les transcripcions si encara hi són.
  for (const h of historial) {
    const t = d.tokens.perDia[h.data];
    if (t) {
      h.tokensDia = d.tokens.suma(t);
      h.tokensSortidaDia = t.sortida;
      h.costDia = Math.round(t.cost * 100) / 100;
    }
  }
  writeFileSync(fitxer, JSON.stringify(historial, null, 2) + "\n");
  return historial;
}

// ---------- Gràfics (SVG inline) ----------

function graficEvolucio(historial) {
  const W = 480, H = 220, M = { e: 46, d: 16, s: 20, i: 30 };
  if (historial.length === 0) return "";
  const x = (i) => M.e + (historial.length === 1 ? (W - M.e - M.d) / 2 : (i * (W - M.e - M.d)) / (historial.length - 1));
  const y = (p) => M.s + (1 - p / 100) * (H - M.s - M.i);
  const graella = [0, 25, 50, 75, 100]
    .map((p) => `<line x1="${M.e}" x2="${W - M.d}" y1="${y(p)}" y2="${y(p)}" class="graella"/><text x="${M.e - 6}" y="${y(p) + 4}" class="eix" text-anchor="end">${p}%</text>`)
    .join("");
  const punts = historial.map((h, i) => `${x(i)},${y(h.percentGlobal)}`).join(" ");
  const etiquetes = historial
    .map((h, i) => (historial.length <= 8 || i % Math.ceil(historial.length / 8) === 0 || i === historial.length - 1 ? `<text x="${x(i)}" y="${H - 8}" class="eix" text-anchor="middle">${dataCat(h.data).slice(0, 5)}</text>` : ""))
    .join("");
  const marques = historial
    .map(
      (h, i) =>
        `<g class="punt"><circle cx="${x(i)}" cy="${y(h.percentGlobal)}" r="12" class="diana"/><circle cx="${x(i)}" cy="${y(h.percentGlobal)}" r="5" class="marca"/><title>${dataCat(h.data)}: ${String(h.percentGlobal).replace(".", ",")} % fet · ${h.resultatsFets}/${h.resultatsTotals} resultats · ${num(h.tokensDia)} tokens · ${h.commitsDia} canvis desats</title></g>`,
    )
    .join("");
  const ultim = historial[historial.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolució del percentatge fet: ${String(ultim.percentGlobal).replace(".", ",")} % el ${dataCat(ultim.data)}">${graella}
    ${historial.length > 1 ? `<polyline points="${punts}" class="linia"/>` : ""}${marques}${etiquetes}
    <text x="${x(historial.length - 1)}" y="${y(ultim.percentGlobal) - 14}" class="valor" text-anchor="${historial.length > 1 ? "end" : "middle"}">${String(Math.round(ultim.percentGlobal)).replace(".", ",")} %</text></svg>`;
}

function graficTokens(perDia) {
  const dies = Object.keys(perDia).sort();
  if (dies.length === 0) return '<p class="suau">Encara no hi ha tokens registrats en aquest PC.</p>';
  const W = 480, H = 200, M = { e: 52, d: 12, s: 16, i: 30 };
  const valors = dies.map((d) => perDia[d].sortida);
  const max = Math.max(...valors, 1);
  const pas = (W - M.e - M.d) / dies.length;
  const amplada = Math.min(48, pas - 2);
  const y = (v) => M.s + (1 - v / max) * (H - M.s - M.i);
  const nivells = [0, max / 2, max].map((v) => `<line x1="${M.e}" x2="${W - M.d}" y1="${y(v)}" y2="${y(v)}" class="graella"/><text x="${M.e - 6}" y="${y(v) + 4}" class="eix" text-anchor="end">${compacte(v)}</text>`).join("");
  const barres = dies
    .map((d, i) => {
      const v = perDia[d].sortida;
      const cx = M.e + pas * i + pas / 2;
      const alt = Math.max(1, H - M.i - y(v));
      const r = Math.min(4, amplada / 2, alt);
      const x0 = cx - amplada / 2, y0 = H - M.i - alt;
      // Barra amb les puntes de dalt arrodonides (4 px) i ancorada a la base.
      const p = `M${x0},${H - M.i} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + amplada - r} Q${x0 + amplada},${y0} ${x0 + amplada},${y0 + r} V${H - M.i} Z`;
      return `<g class="punt"><rect x="${cx - pas / 2}" y="${M.s}" width="${pas}" height="${H - M.s - M.i}" class="diana-rect"/><path d="${p}" class="barra"/>
        <title>${dataCat(d)}: ${num(v)} tokens generats · ${num(perDia[d].entrada + perDia[d].cacheEscrita + perDia[d].cacheLlegida)} tokens llegits · ${perDia[d].missatges} respostes</title>
        <text x="${cx}" y="${H - 8}" class="eix" text-anchor="middle">${dataCat(d).slice(0, 5)}</text></g>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tokens generats per dia">${nivells}${barres}</svg>`;
}

// ---------- HTML ----------

const ESTATS = {
  verificat: { text: "Verificat", icona: "✔✔", classe: "e-verificat" },
  verd: { text: "Proves en verd", icona: "✔", classe: "e-verd" },
  vermell: { text: "Proves en vermell", icona: "✖", classe: "e-vermell" },
  fallat: { text: "Revisió no superada", icona: "✖", classe: "e-vermell" },
  manual: { text: "Comprovació manual", icona: "✋", classe: "e-manual" },
  pendent: { text: "Pendent", icona: "○", classe: "e-pendent" },
};

const dolars = (v) => `${(v ?? 0).toLocaleString("ca-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

function html(d, historial) {
  const tk = d.tokens;
  const totalTokens = tk.suma(tk.total);
  const dies = Object.keys(tk.perDia).sort().reverse();
  const sessions = Object.entries(tk.perSessio).sort((a, b) => String(b[1].inici).localeCompare(String(a[1].inici)));
  const perDiaCommits = {};
  for (const c of d.commits) (perDiaCommits[c.dia] ??= []).push(c);
  const diesCommits = Object.keys(perDiaCommits).sort().reverse();
  const totsRes = d.blocs.flatMap((b) => b.outcomes?.resultats ?? []);
  const fets = totsRes.filter((r) => r.estat === "verd" || r.estat === "verificat").length;
  const provesOk = d.proves.filter((p) => p.ok).length;
  const darreresProves = [d.vt.data, d.pw.data].filter(Boolean).sort((a, b) => b - a)[0];
  const blocActual = d.blocs.find((b) => b.percent < 100) ?? d.blocs[d.blocs.length - 1];

  const blocsHtml = d.blocs
    .map(
      (b) => `<li class="bloc">
      <div class="bloc-cap"><span><strong>${b.num}. ${esc(b.nom)}</strong> <span class="suau">· pes ${b.pes} %</span></span><span class="xifra">${Math.round(b.percent)} %</span></div>
      <div class="mesura" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(b.percent)}" aria-label="Bloc ${b.num} ${esc(b.nom)}"><span style="width:${b.percent.toFixed(1)}%"></span></div>
      <p class="suau">${b.outcomes ? `${b.fets} de ${b.total} resultats fets · ${esc(b.outcomes.estatFitxer || "sense estat")}` : "Encara sense fitxer de resultats"}</p></li>`,
    )
    .join("");

  const taulaResultats = d.blocs
    .filter((b) => b.outcomes)
    .map(
      (b) => `<h3>${esc(b.outcomes.titol)}</h3>
      <div class="taula-contenidor"><table class="resultats"><thead><tr><th scope="col">Id</th><th scope="col">Cas</th><th scope="col">Estat</th><th scope="col">Proves</th></tr></thead><tbody>
      ${b.outcomes.resultats
        .map((r) => {
          const e = ESTATS[r.estat];
          return `<tr><td class="id"><strong>${esc(r.id)}</strong></td><td class="cas">${esc(r.cas)}</td><td><span class="estat ${e.classe}"><span aria-hidden="true">${e.icona}</span> ${e.text}</span></td><td class="proves">${r.proves ? `${r.provesOk}/${r.proves} proves` : "—"}</td></tr>`;
        })
        .join("")}</tbody></table></div>`,
    )
    .join("");

  const fetHtml = diesCommits.length
    ? diesCommits
        .map(
          (dia) => `<details ${dia === diesCommits[0] ? "open" : ""}><summary><strong>${dataCat(dia)}</strong> · ${perDiaCommits[dia].length} ${perDiaCommits[dia].length === 1 ? "canvi desat" : "canvis desats"}</summary>
          <ul class="fets">${perDiaCommits[dia].map((c) => `<li><span class="suau">${c.hora}</span> ${esc(c.missatge)} <span class="suau">· ${esc(c.autor)}</span></li>`).join("")}</ul></details>`,
        )
        .join("")
    : '<p class="suau">Encara no hi ha canvis desats.</p>';

  const taulaTokensDia = dies
    .map((dia) => {
      const t = tk.perDia[dia];
      return `<tr><td>${dataCat(dia)}</td><td class="n">${num(t.sortida)}</td><td class="n amagable">${num(t.entrada + t.cacheEscrita)}</td><td class="n amagable">${num(t.cacheLlegida)}</td><td class="n">${num(tk.suma(t))}</td><td class="n"><strong>${dolars(t.cost)}</strong></td><td class="n amagable">${t.missatges}</td></tr>`;
    })
    .join("");
  const taulaSessions = sessions
    .map(([id, t]) => {
      const inici = new Date(t.inici), fi = new Date(t.fi);
      return `<tr><td>${dataCat(diaMadrid(inici))} ${horaMadrid(inici)}–${horaMadrid(fi)}</td><td class="amagable"><code>${esc(id.slice(0, 8))}</code></td><td class="n">${num(t.sortida)}</td><td class="n">${num(tk.suma(t))}</td><td class="n"><strong>${dolars(t.cost)}</strong></td><td class="n amagable">${t.missatges}</td></tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tauler · The Glow Club</title>
<style>
:root{--vermell:#DE2F40;--vermell-fosc:#B81F30;--rosa:#F6A3DB;--rosa-clar:#FCE4F2;--fons:#FAF6F7;--text:#3A1830;--suau:#6E5566;--vora:#E7D6DF;--blanc:#fff;
--bo:#1F7A4A;--avis:#8A5A00;--critic:#B81F30;color-scheme:light;font-family:Poppins,"Segoe UI",system-ui,-apple-system,sans-serif;color:var(--text);background:var(--fons)}
*{box-sizing:border-box}html,body{margin:0;overflow-x:hidden}body{padding:16px;max-width:1100px;margin:0 auto}
h1,h2,h3{font-family:"DM Serif Display",Georgia,serif;font-weight:400;margin:0 0 8px}h1{color:var(--vermell);font-size:1.9rem}h2{font-size:1.35rem}h3{font-size:1.1rem;margin-top:16px}
.suau{color:var(--suau);font-size:.9rem}p{margin:4px 0}
.capcalera{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:16px}
.targeta{background:var(--blanc);border:1px solid var(--vora);border-radius:14px;padding:16px;margin-bottom:16px;min-width:0}
.rajoles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px}
.rajola{background:var(--blanc);border:1px solid var(--vora);border-radius:14px;padding:14px}
.rajola .etiqueta{font-size:.85rem;color:var(--suau)}.rajola .gran{font-size:2rem;font-weight:700;line-height:1.1;margin:4px 0}.rajola.destacada{background:var(--rosa-clar);border-color:var(--rosa)}
.mesura{height:10px;border-radius:5px;background:var(--rosa-clar);overflow:hidden;margin:6px 0}.mesura span{display:block;height:100%;background:var(--vermell);border-radius:5px}
.blocs{list-style:none;margin:0;padding:0}.bloc{padding:10px 0;border-bottom:1px solid var(--vora)}.bloc:last-child{border-bottom:0}
.bloc-cap{display:flex;justify-content:space-between;gap:8px}.xifra{font-weight:700}
.dues{display:grid;grid-template-columns:1fr;gap:16px}@media(min-width:900px){.dues{grid-template-columns:1fr 1fr}}
svg{width:100%;max-width:760px;height:auto;display:block}.graella{stroke:var(--vora);stroke-width:1}.eix{fill:var(--suau);font-size:14px}
.linia{fill:none;stroke:var(--vermell);stroke-width:2;stroke-linejoin:round}.marca{fill:var(--vermell);stroke:var(--blanc);stroke-width:2}.diana,.diana-rect{fill:transparent}
.barra{fill:var(--vermell)}.punt:hover .barra,.punt:hover .marca{fill:var(--vermell-fosc)}.valor{fill:var(--text);font-size:16px;font-weight:700}
.taula-contenidor{overflow-x:auto;max-width:100%}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--vora);vertical-align:top}th{font-weight:600;color:var(--suau)}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.estat{display:inline-flex;gap:4px;align-items:center;white-space:nowrap;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid currentColor;font-size:.8rem}
.e-verificat,.e-verd{color:var(--bo)}.e-vermell{color:var(--critic)}.e-manual{color:var(--avis)}.e-pendent{color:var(--suau)}
details{border-bottom:1px solid var(--vora);padding:8px 0}summary{cursor:pointer;min-height:32px}.fets{margin:6px 0 0;padding-left:18px}.fets li{margin:4px 0}
.nota{background:var(--rosa-clar);border-radius:10px;padding:10px 12px;font-size:.9rem}
td.id{white-space:nowrap}
@media(max-width:600px){body{padding:12px}table{font-size:.85rem}.amagable{display:none}
.resultats thead{display:none}.resultats tr{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;padding:10px 0;border-bottom:1px solid var(--vora)}.resultats td{border:0;padding:0}.resultats td.cas{grid-column:2}.resultats td:nth-child(3){grid-column:2}.resultats td.proves{grid-column:2;color:var(--suau)}.resultats td.id{grid-row:span 3}}
</style></head>
<body>
<header class="capcalera"><div><h1>The Glow Club · Tauler del projecte</h1>
<p class="suau">Actualitzat el ${dataCat(d.avui)} a les ${horaMadrid(d.ara)}${d.branca ? ` · branca <code>${esc(d.branca)}</code>` : ""}</p></div></header>

<section class="rajoles" aria-label="Xifres principals">
  <div class="rajola destacada"><div class="etiqueta">Projecte fet</div><div class="gran">${Math.round(d.global)} %</div><div class="mesura" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(d.global)}" aria-label="Projecte fet"><span style="width:${d.global.toFixed(1)}%"></span></div><div class="suau">Falta un ${Math.round(100 - d.global)} %</div></div>
  <div class="rajola"><div class="etiqueta">Bloc en curs</div><div class="gran">${Math.round(blocActual.percent)} %</div><div class="suau">${blocActual.num}. ${esc(blocActual.nom)}</div></div>
  <div class="rajola"><div class="etiqueta">Resultats fets</div><div class="gran">${fets}/${totsRes.length}</div><div class="suau">dels blocs amb resultats aprovats</div></div>
  <div class="rajola"><div class="etiqueta">Dies per a la fira</div><div class="gran">${d.diesFira >= 0 ? d.diesFira : "—"}</div><div class="suau">${dataCat(d.config.dataFira)} · proves a l'iPad abans del 03/12</div></div>
  <div class="rajola"><div class="etiqueta">Tokens consumits</div><div class="gran">${compacte(totalTokens)}</div><div class="suau">${num(tk.total.sortida)} generats</div></div>
  <div class="rajola"><div class="etiqueta">Cost dels tokens</div><div class="gran">${dolars(tk.total.cost)}</div><div class="suau">equivalent a preu d'API${tk.perDia[d.avui] ? ` · avui ${dolars(tk.perDia[d.avui].cost)}` : ""}</div></div>
</section>

<section class="targeta"><h2>Curs del projecte</h2><p class="suau">Percentatge fet cada dia (passa el cursor o toca un punt per veure'n el detall).</p>
${graficEvolucio(historial)}
<details><summary>Veure com a taula</summary><div class="taula-contenidor"><table><thead><tr><th>Dia</th><th class="n">% fet</th><th class="n">Resultats</th><th class="n">Tokens</th><th class="n">Cost</th><th class="n">Canvis</th></tr></thead><tbody>
${[...historial].reverse().map((h) => `<tr><td>${dataCat(h.data)}</td><td class="n">${String(h.percentGlobal).replace(".", ",")} %</td><td class="n">${h.resultatsFets}/${h.resultatsTotals}</td><td class="n">${num(h.tokensDia)}</td><td class="n">${dolars(h.costDia)}</td><td class="n">${h.commitsDia}</td></tr>`).join("")}
</tbody></table></div></details></section>

<div class="dues">
<section class="targeta"><h2>Blocs</h2><p class="suau">Ordre de construcció de l'especificació v2.0. Un bloc compta segons els seus resultats en verd o verificats.</p><ul class="blocs">${blocsHtml}</ul></section>
<section class="targeta"><h2>Proves automàtiques</h2>
<p><strong>${provesOk}</strong> de <strong>${d.proves.length}</strong> proves passen${darreresProves ? ` · última execució ${dataCat(diaMadrid(darreresProves))} ${horaMadrid(darreresProves)}` : ""}.</p>
<p class="suau">Vitest: ${d.vt.proves.filter((p) => p.ok).length}/${d.vt.proves.length} · Playwright: ${d.pw.proves.filter((p) => p.ok).length}/${d.pw.proves.length}${d.pw.proves.length ? "" : " (encara no s'han executat)"}</p>
<div class="nota" style="margin-top:10px"><strong>Llegenda d'estats.</strong> <span class="estat e-verificat">✔✔ Verificat</span>: el revisor independent l'ha comprovat. <span class="estat e-verd">✔ Proves en verd</span>: les proves passen. <span class="estat e-vermell">✖ Proves en vermell</span>: alguna falla. <span class="estat e-manual">✋ Manual</span>: es comprova a mà al desplegament. <span class="estat e-pendent">○ Pendent</span>: encara sense prova.</div>
</section></div>

<section class="targeta"><h2>Resultats per bloc</h2>${taulaResultats || '<p class="suau">Encara no hi ha cap fitxer de resultats.</p>'}</section>

<section class="targeta"><h2>Coses fetes</h2><p class="suau">Canvis desats al repositori (git), per dia.</p>${fetHtml}</section>

<section class="targeta"><h2>Tokens i cost</h2>
<p class="suau">Tokens generats per Claude cada dia (passa el cursor per veure'n el detall).</p>
${graficTokens(tk.perDia)}
<h3>Per dia</h3><div class="taula-contenidor"><table><thead><tr><th>Dia</th><th class="n">Generats</th><th class="n amagable">Llegits nous</th><th class="n amagable">Llegits de memòria cau</th><th class="n">Total</th><th class="n">Cost</th><th class="n amagable">Respostes</th></tr></thead>
<tbody>${taulaTokensDia}</tbody>
<tfoot><tr><th>Total</th><th class="n">${num(tk.total.sortida)}</th><th class="n amagable">${num(tk.total.entrada + tk.total.cacheEscrita)}</th><th class="n amagable">${num(tk.total.cacheLlegida)}</th><th class="n">${num(totalTokens)}</th><th class="n">${dolars(tk.total.cost)}</th><th class="n amagable">${tk.total.missatges}</th></tr></tfoot></table></div>
<h3>Per sessió</h3><div class="taula-contenidor"><table><thead><tr><th>Quan</th><th class="amagable">Sessió</th><th class="n">Generats</th><th class="n">Total</th><th class="n">Cost</th><th class="n amagable">Respostes</th></tr></thead>
<tbody>${taulaSessions}</tbody></table></div>
<p class="nota" style="margin-top:10px">Inclou les sessions de Claude Code fetes en aquest PC (també els agents auxiliars). Les sessions anteriors fetes a claude.ai/code (web) no són al PC i no hi compten. «Llegits de memòria cau» són tokens de context reaprofitat, molt més barats que els generats.</p>
<p class="nota" style="margin-top:10px"><strong>Sobre el cost.</strong> És el que costarien aquests tokens a preu de l'API d'Anthropic, en dòlars (${esc(d.config.preus?.font ?? CONFIG_PER_DEFECTE.preus.font)}; Opus 5.5: 4 $ entrada, 20 $ generats, 0,20 $ de memòria cau per milió de tokens). Si fas servir Claude Code amb una subscripció, no és el que pagues: serveix per veure quant ha costat cada part. Els preus es poden canviar a <code>tauler/config.json</code>.${tk.modelsSensePreu.length ? ` Models sense preu configurat (calculats com Opus 5.5): ${esc(tk.modelsSensePreu.join(", "))}.` : ""}</p>
</section>
<p class="suau">Es regenera sol en acabar cada torn de Claude Code en aquest projecte, o a mà amb <code>npm run tauler</code>.</p>
</body></html>
`;
}

// ---------- Principal ----------

try {
  mkdirSync(DIR, { recursive: true });
  if (!existsSync(path.join(DIR, "config.json"))) writeFileSync(path.join(DIR, "config.json"), JSON.stringify(CONFIG_PER_DEFECTE, null, 2) + "\n");
  const d = calcula();
  const historial = actualitzaHistorial(d);
  writeFileSync(path.join(DIR, "index.html"), html(d, historial));
  if (!SILENCI) {
    console.log(`Tauler actualitzat: tauler/index.html`);
    console.log(`  Projecte fet: ${d.global.toFixed(1)} % · ${d.blocs.map((b) => `B${b.num} ${Math.round(b.percent)}%`).join(" · ")}`);
    console.log(`  Proves: ${d.proves.filter((p) => p.ok).length}/${d.proves.length} · Tokens: ${num(d.tokens.suma(d.tokens.total))} (${num(d.tokens.total.sortida)} generats) · Cost: ${dolars(d.tokens.total.cost)}`);
  }
} catch (e) {
  if (!SILENCI) {
    console.error(e);
    process.exit(1);
  }
}
process.exit(0);
