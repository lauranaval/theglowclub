// App de paradeta de The Glow Club (bloc 1 · Fira). Funciona sense connexió: tot es desa primer al dispositiu.
import { eurosACents, formatEuros } from "../shared/diners";
import { afegeixCharm, afegeixLliure, afegeixProducte, canviaPreu, totalLinies, treuLinia, type ProducteCataleg } from "../shared/tiquet";
import { calculaTancament, diaLocal, resumVendes, type Anulacio, type Caixa, type Linia, type Metode, type Venda } from "../shared/venda";
import * as db from "./magatzem";

type Pantalla = "vendre" | "caixa" | "resum" | "fira" | "mes";

interface Taller {
  id: string;
  esdevenimentId: string | null;
  nom: string;
  data: string | null;
  public: string;
  modalitat: string;
  preuCents: number | null;
  ocupacio: string;
}
interface Esdeveniment {
  id: string;
  nom: string;
  dataInici: string;
  dataFi: string;
  ubicacio: string | null;
  notes: string | null;
}
interface DadesConsulta {
  usuaria: string;
  cataleg: ProducteCataleg[];
  esdeveniments: Esdeveniment[];
  tallers: Taller[];
  generatA: string;
}

const MIDA_LOT = 50;
const PERIODE_SYNC_MS = 30_000;

const estat = {
  pantalla: "vendre" as Pantalla,
  dispositiuId: "",
  dades: null as DadesConsulta | null,
  vendes: [] as db.AmbSync<Venda>[],
  anulacions: [] as db.AmbSync<Anulacio>[],
  caixes: [] as db.AmbSync<Caixa>[],
  tiquet: [] as Linia[],
  enLinia: navigator.onLine,
  sessioCaducada: false,
  sincronitzant: false,
  darreraSync: null as string | null,
  persistent: null as boolean | null,
  fitxes: {} as Record<string, { caixa: { nombreVendes: number; efectiuCents: number; targetaCents: number; netCents: number; nombreCaixes: number }; consultadaA: string }>,
  resumServidor: null as null | {
    nombreVendes: number;
    netCents: number;
    efectiuCents: number;
    targetaCents: number;
    nombreCaixes: number;
    vendes?: { id: string; anulacio: (Anulacio & { registradaPer?: string }) | null }[];
  },
};

// ---------- Utilitats ----------

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const hora = (iso: string) => new Date(iso).toLocaleTimeString("ca-ES", { hour: "2-digit", minute: "2-digit" });
const dataCurta = (dia: string) => dia.split("-").reverse().join("/");
const dataHora = (iso: string) => `${dataCurta(diaLocal(new Date(iso)))} ${hora(iso)}`;
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const nouId = () => crypto.randomUUID();
const usuaria = () => estat.dades?.usuaria ?? "desconeguda";

function caixaActual(): db.AmbSync<Caixa> | null {
  const meves = estat.caixes.filter((c) => c.dispositiuId === estat.dispositiuId).sort((a, b) => b.obertaA.localeCompare(a.obertaA));
  return meves[0] ?? null;
}
const caixaOberta = () => {
  const c = caixaActual();
  return c && c.tancadaA == null ? c : null;
};

function nombrePendents() {
  return {
    vendes: estat.vendes.filter((v) => v.sync === 0).length,
    altres: estat.anulacions.filter((a) => a.sync === 0).length + estat.caixes.filter((c) => c.sync === 0).length,
    errors: estat.vendes.filter((v) => v.sync === 2).length + estat.anulacions.filter((a) => a.sync === 2).length + estat.caixes.filter((c) => c.sync === 2).length,
  };
}

// ---------- Inici ----------

async function inicia() {
  estat.dispositiuId = (await db.llegeixMeta<string>("dispositiuId")) ?? "";
  if (!estat.dispositiuId) {
    estat.dispositiuId = `disp-${nouId()}`;
    await db.desaMeta("dispositiuId", estat.dispositiuId);
  }
  estat.dades = (await db.llegeixMeta<DadesConsulta>("dades")) ?? null;
  estat.darreraSync = (await db.llegeixMeta<string>("darreraSync")) ?? null;
  estat.fitxes = (await db.llegeixMeta<typeof estat.fitxes>("fitxes")) ?? {};
  await recarregaLocal();
  dibuixaEstructura();
  dibuixa();

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  if (navigator.storage?.persist) {
    estat.persistent = (await navigator.storage.persisted()) || (await navigator.storage.persist().catch(() => false));
  }

  window.addEventListener("online", () => {
    estat.enLinia = true;
    void sincronitza();
  });
  window.addEventListener("offline", () => {
    estat.enLinia = false;
    dibuixaBarra();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void sincronitza();
  });
  setInterval(() => void sincronitza(), PERIODE_SYNC_MS);
  await sincronitza({ dades: true });
}

async function recarregaLocal() {
  [estat.vendes, estat.anulacions, estat.caixes] = await Promise.all([
    db.tots<Venda>("vendes"),
    db.tots<Anulacio>("anulacions"),
    db.tots<Caixa>("caixes"),
  ]);
  estat.vendes.sort((a, b) => a.creadaA.localeCompare(b.creadaA));
}

// ---------- Sincronització ----------

type Resposta = { tipus: "ok"; cos: any } | { tipus: "sessio" } | { tipus: "xarxa" };

async function crida(ruta: string, init: RequestInit = {}): Promise<Resposta> {
  if (!navigator.onLine) return { tipus: "xarxa" };
  try {
    const r = await fetch(ruta, { ...init, redirect: "manual", credentials: "same-origin", cache: "no-store" });
    // Access redirigeix a la pàgina d'entrada quan la sessió ha caducat.
    if (r.type === "opaqueredirect" || r.status === 401 || r.status === 403 || (r.status >= 300 && r.status < 400)) return { tipus: "sessio" };
    if (!r.ok) return { tipus: "xarxa" };
    return { tipus: "ok", cos: await r.json() };
  } catch {
    return { tipus: "xarxa" };
  }
}

let repetir: { dades?: boolean } | null = null;

async function sincronitza(opcions: { dades?: boolean } = {}) {
  // Si ja s'està sincronitzant, en fem una altra volta en acabar (p. ex. una venda feta mentrestant).
  if (estat.sincronitzant) {
    repetir = { dades: Boolean(repetir?.dades || opcions.dades) };
    return;
  }
  estat.sincronitzant = true;
  dibuixaBarra();
  try {
    let resultat: "ok" | "sessio" | "xarxa" = "ok";
    if (opcions.dades || !estat.dades) resultat = await descarregaDades();
    while (resultat === "ok") {
      let p = await db.pendents();
      // Una anul·lació d'una venda que el servidor ha rebutjat no es pot enviar mai: queda com a error, no com a pendent.
      const vendesRebutjades = new Set(estat.vendes.filter((v) => v.sync === 2).map((v) => v.id));
      const orfes = p.anulacions.filter((a) => vendesRebutjades.has(a.vendaId));
      if (orfes.length) {
        await db.marca(orfes.map((a) => ({ magatzem: "anulacions" as const, id: a.id, sync: 2 as const, errors: ["la venda no s'ha pogut sincronitzar"] })));
        await recarregaLocal();
        p = await db.pendents();
      }
      if (p.vendes.length + p.anulacions.length + p.caixes.length === 0) break;
      const vendes = p.vendes.slice(0, MIDA_LOT);
      const ids = new Set(vendes.map((v) => v.id));
      const sincronitzades = new Set(estat.vendes.filter((v) => v.sync === 1).map((v) => v.id));
      const anulacions = p.anulacions.filter((a) => ids.has(a.vendaId) || sincronitzades.has(a.vendaId));
      const enviats = {
        caixes: new Map(p.caixes.map((c) => [c.id, db.senseEstat(c)])),
        vendes: new Map(vendes.map((v) => [v.id, db.senseEstat(v)])),
        anulacions: new Map(anulacions.map((a) => [a.id, db.senseEstat(a)])),
      };
      const r = await crida("/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dispositiuId: estat.dispositiuId,
          caixes: [...enviats.caixes.values()],
          vendes: [...enviats.vendes.values()],
          anulacions: [...enviats.anulacions.values()],
        }),
      });
      if (r.tipus !== "ok") {
        resultat = r.tipus;
        break;
      }
      const { acceptades, rebutjades } = r.cos as {
        acceptades: { caixes: string[]; vendes: string[]; anulacions: string[] };
        rebutjades: { tipus: "caixa" | "venda" | "anulacio"; id: string; errors: string[] }[];
      };
      const magatzem = { caixa: "caixes", venda: "vendes", anulacio: "anulacions" } as const;
      await db.marca([
        ...acceptades.caixes.map((id) => ({ magatzem: "caixes" as const, id, sync: 1 as const, enviat: enviats.caixes.get(id) })),
        ...acceptades.vendes.map((id) => ({ magatzem: "vendes" as const, id, sync: 1 as const, enviat: enviats.vendes.get(id) })),
        ...acceptades.anulacions.map((id) => ({ magatzem: "anulacions" as const, id, sync: 1 as const, enviat: enviats.anulacions.get(id) })),
        ...rebutjades.map((x) => ({ magatzem: magatzem[x.tipus], id: x.id, sync: 2 as const, errors: x.errors, enviat: enviats[magatzem[x.tipus]].get(x.id) })),
      ]);
      await recarregaLocal();
      // Si una anul·lació espera una venda que encara no s'ha enviat, sortim i ho reprenem a la propera volta.
      if (acceptades.vendes.length + acceptades.caixes.length + acceptades.anulacions.length + rebutjades.length === 0) break;
    }
    if (resultat === "ok") {
      estat.enLinia = true;
      estat.sessioCaducada = false;
      if (nombrePendents().vendes + nombrePendents().altres === 0) {
        estat.darreraSync = new Date().toISOString();
        await db.desaMeta("darreraSync", estat.darreraSync);
      }
      await actualitzaResumServidor();
      await actualitzaFitxes();
    } else if (resultat === "sessio") {
      estat.enLinia = true;
      estat.sessioCaducada = true;
    } else {
      estat.enLinia = false;
    }
  } finally {
    estat.sincronitzant = false;
    // Una sincronització en segon pla no ha d'esborrar el que l'usuària està escrivint.
    dibuixa({ respectaFormularis: true });
    if (repetir) {
      const seguent = repetir;
      repetir = null;
      void sincronitza(seguent);
    }
  }
}

async function descarregaDades(): Promise<"ok" | "sessio" | "xarxa"> {
  const r = await crida("/api/dades");
  if (r.tipus !== "ok") return r.tipus;
  estat.dades = r.cos as DadesConsulta;
  await db.desaMeta("dades", estat.dades);
  return "ok";
}

/** Resum de cada esdeveniment amb totes les caixes sincronitzades; es desa per consultar-lo sense connexió. */
async function actualitzaFitxes() {
  for (const e of estat.dades?.esdeveniments ?? []) {
    const r = await crida(`/api/esdeveniments/${encodeURIComponent(e.id)}`);
    if (r.tipus !== "ok") return;
    estat.fitxes[e.id] = { caixa: r.cos.caixa, consultadaA: new Date().toISOString() };
  }
  await db.desaMeta("fitxes", estat.fitxes);
}

async function actualitzaResumServidor() {
  const r = await crida(`/api/resum?dia=${diaLocal()}`);
  estat.resumServidor = r.tipus === "ok" ? r.cos : null;
}

// ---------- Accions ----------

async function obreCaixa(form: HTMLFormElement) {
  // Sense les dades de /api/dades no se sap qui ven: no es pot obrir caixa.
  if (!estat.dades) return;
  const dades = new FormData(form);
  const canvi = eurosACents(String(dades.get("canvi") ?? ""));
  if (canvi == null) return avisa("Escriu el canvi inicial en euros (per exemple, 50).");
  const esd = String(dades.get("esdeveniment") ?? "") || null;
  const caixa: db.AmbSync<Caixa> = {
    id: nouId(),
    dispositiuId: estat.dispositiuId,
    esdevenimentId: esd,
    dia: diaLocal(),
    obertaA: new Date().toISOString(),
    canviInicialCents: canvi,
    usuariaObertura: usuaria(),
    tancadaA: null,
    recompteEfectiuCents: null,
    tpvTargetaCents: null,
    nota: null,
    usuariaTancament: null,
    sync: 0,
  };
  await db.desa("caixes", caixa);
  await recarregaLocal();
  estat.pantalla = "vendre";
  dibuixa();
  void sincronitza();
}

async function cobra(metode: Metode) {
  const caixa = caixaOberta();
  if (!caixa || !estat.dades || estat.tiquet.length === 0) return;
  const linies = estat.tiquet;
  const venda: db.AmbSync<Venda> = {
    id: nouId(),
    caixaId: caixa.id,
    dispositiuId: estat.dispositiuId,
    esdevenimentId: caixa.esdevenimentId,
    dia: diaLocal(),
    creadaA: new Date().toISOString(),
    metode,
    linies,
    totalCents: totalLinies(linies),
    usuaria: usuaria(),
    sync: 0,
  };
  await db.desa("vendes", venda);
  estat.tiquet = [];
  await recarregaLocal();
  dibuixa();
  mostraToast(`Venda desada · ${formatEuros(venda.totalCents)} ${metode === "efectiu" ? "en efectiu" : "amb targeta"}`, async () => {
    await anulaVenda(venda.id, "Desfeta en el moment de cobrar");
  });
  void sincronitza();
}

async function anulaVenda(vendaId: string, motiu: string) {
  if (estat.anulacions.some((a) => a.vendaId === vendaId)) return;
  await db.desa("anulacions", { id: nouId(), vendaId, motiu, usuaria: usuaria(), creadaA: new Date().toISOString(), sync: 0 });
  await recarregaLocal();
  dibuixa();
  void sincronitza();
}

async function tancaCaixa(recompte: number, tpv: number, nota: string) {
  const caixa = caixaOberta();
  if (!caixa) return;
  await db.desa("caixes", {
    ...caixa,
    tancadaA: new Date().toISOString(),
    recompteEfectiuCents: recompte,
    tpvTargetaCents: tpv,
    nota: nota.trim() || null,
    usuariaTancament: usuaria(),
    sync: 0,
  });
  await recarregaLocal();
  dibuixa();
  void sincronitza();
}

/** Torna a posar com a pendents els registres rebutjats (p. ex. si s'ha corregit la llista d'usuàries) i els reenvia. */
async function tornaAEnviar() {
  await db.tornaAPendents();
  await recarregaLocal();
  dibuixa();
  void sincronitza();
}

function descarregaCopia() {
  const pendentsDe = <T extends { sync: db.EstatSync }>(l: T[]) => l.filter((x) => x.sync !== 1);
  const copia = {
    generadaA: new Date().toISOString(),
    dispositiuId: estat.dispositiuId,
    usuaria: usuaria(),
    caixes: pendentsDe(estat.caixes),
    vendes: pendentsDe(estat.vendes),
    anulacions: pendentsDe(estat.anulacions),
  };
  const ara = new Date();
  const nom = `glow-vendes-pendents-${diaLocal(ara)}-${String(ara.getHours()).padStart(2, "0")}${String(ara.getMinutes()).padStart(2, "0")}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(copia, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ---------- Diàlegs i avisos ----------

function dialeg(titol: string, cos: string, botoSi: string): Promise<FormData | null> {
  return new Promise((resolve) => {
    const d = document.createElement("dialog");
    const id = `d-${nouId()}`;
    d.setAttribute("aria-labelledby", id);
    d.innerHTML = `<form method="dialog" class="dialeg"><h2 id="${id}">${esc(titol)}</h2>${cos}
      <div class="accions"><button type="button" class="boto secundari" data-no>Cancel·lar</button>
      <button type="submit" class="boto primari" value="si">${esc(botoSi)}</button></div></form>`;
    document.body.append(d);
    const form = d.querySelector("form")!;
    d.querySelector("[data-no]")!.addEventListener("click", () => d.close());
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      d.close();
      resolve(fd);
    });
    d.addEventListener("close", () => {
      d.remove();
      resolve(null);
    });
    d.showModal();
    d.querySelector<HTMLInputElement>("input, textarea")?.focus();
  });
}

function avisa(text: string) {
  void dialeg("Atenció", `<p>${esc(text)}</p>`, "D'acord");
}

let temporitzadorToast: ReturnType<typeof setTimeout> | undefined;
function mostraToast(text: string, desfer?: () => Promise<void>) {
  const t = $("#toast");
  t.innerHTML = `<span>${esc(text)}</span>${desfer ? '<button type="button" class="boto secundari">Desfer</button>' : ""}`;
  t.hidden = false;
  t.querySelector("button")?.addEventListener("click", async () => {
    t.hidden = true;
    await desfer?.();
  });
  clearTimeout(temporitzadorToast);
  temporitzadorToast = setTimeout(() => (t.hidden = true), 5000);
}

// ---------- Dibuix ----------

const NAV: [Pantalla, string, string][] = [
  ["vendre", "Vendre", "🛍"],
  ["caixa", "Caixa", "💶"],
  ["resum", "Resum", "📊"],
  ["fira", "Fira", "🎄"],
  ["mes", "Més", "⋯"],
];

function dibuixaEstructura() {
  $("#app").innerHTML = `
    <header class="capcalera"><span class="logo">The Glow Club</span><span class="qui" id="qui"></span></header>
    <div class="barra-sync" role="status" aria-label="Estat de sincronització"><span id="text-sync"></span>
      <button type="button" class="boto secundari petit" id="sync-ara">Sincronitzar ara</button></div>
    <div id="avis"></div>
    <nav class="navegacio" aria-label="Seccions">${NAV.map(
      ([id, nom, icona]) => `<button type="button" data-pantalla="${id}" class="${id === "vendre" ? "central" : ""}"><span aria-hidden="true">${icona}</span><span>${nom}</span></button>`,
    ).join("")}</nav>
    <main id="principal" tabindex="-1"></main>
    <div id="cobrament-lloc"></div>
    <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>`;
  document.querySelectorAll<HTMLButtonElement>("[data-pantalla]").forEach((b) =>
    b.addEventListener("click", () => {
      estat.pantalla = b.dataset.pantalla as Pantalla;
      dibuixa();
      if (estat.pantalla === "fira") void actualitzaFitxes().then(() => estat.pantalla === "fira" && dibuixa());
      window.scrollTo(0, 0);
    }),
  );
  $("#sync-ara").addEventListener("click", () => void sincronitza({ dades: true }));
}

/** Hi ha un formulari a la pantalla amb dades escrites o amb el focus? */
function formulariEnCurs(principal: HTMLElement): boolean {
  const camps = [...principal.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("form input, form textarea")];
  return camps.some((c) => c.value.trim() !== "" || c === document.activeElement);
}

function dibuixa(opcions: { respectaFormularis?: boolean } = {}) {
  document.querySelectorAll<HTMLButtonElement>("[data-pantalla]").forEach((b) => {
    if (b.dataset.pantalla === estat.pantalla) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  $("#qui").textContent = estat.dades?.usuaria ?? "";
  dibuixaBarra();
  const principal = $("#principal");
  const pantalles: Record<Pantalla, () => string> = { vendre: htmlVendre, caixa: htmlCaixa, resum: htmlResum, fira: htmlFira, mes: htmlMes };
  if (opcions.respectaFormularis && formulariEnCurs(principal)) {
    dibuixaCobrament();
    return;
  }
  principal.innerHTML = pantalles[estat.pantalla]();
  connecta(principal);
  dibuixaCobrament();
}

function dibuixaBarra() {
  const { vendes, altres, errors } = nombrePendents();
  const enLinia = estat.enLinia && navigator.onLine;
  const pendentsText = vendes > 0 ? `${vendes} ${vendes === 1 ? "venda" : "vendes"} per sincronitzar` : altres > 0 ? "Canvis de caixa per sincronitzar" : "";
  let text: string;
  if (!enLinia) text = `Sense connexió · ${pendentsText || "Res pendent de sincronitzar"}`;
  else if (pendentsText) text = estat.sincronitzant ? `Sincronitzant… · ${pendentsText}` : pendentsText;
  else if (estat.darreraSync) text = `Tot sincronitzat a les ${hora(estat.darreraSync)}`;
  else text = estat.sincronitzant ? "Connectant…" : "Pendent de connectar";
  if (errors > 0) text += ` · ${errors} amb errors (vegeu Més)`;
  $("#text-sync").textContent = text;
  $(".barra-sync").classList.toggle("fora-de-linia", !enLinia);

  const avis = $("#avis");
  if (estat.sessioCaducada) {
    if (!avis.querySelector("[data-sessio]")) {
      avis.innerHTML = `<div class="avis" role="alert" data-sessio><p><strong>La sessió ha caducat.</strong> Torna a entrar per sincronitzar. Les vendes pendents es conserven en aquest dispositiu.</p>
        <button type="button" class="boto primari" id="torna-entrar">Torna a entrar</button></div>`;
      $("#torna-entrar").addEventListener("click", () => (location.href = "/entrar"));
    }
  } else avis.innerHTML = "";
}

function htmlVendre(): string {
  const caixa = caixaOberta();
  if (!caixa) return htmlObrirCaixa();
  const cataleg = (estat.dades?.cataleg ?? []).filter((p) => p.actiu);
  const esd = estat.dades?.esdeveniments.find((e) => e.id === caixa.esdevenimentId);
  const productes = cataleg.filter((p) => !p.tipusCharm);
  const charms = cataleg.filter((p) => p.tipusCharm);
  return `
    <p class="etiqueta-caixa">Caixa oberta · ${esc(esd?.nom ?? "Sense esdeveniment")} · canvi ${formatEuros(caixa.canviInicialCents)}</p>
    <section aria-label="Catàleg"><div class="graella">${productes
      .map(
        (p) => `<button type="button" class="producte" data-afegeix="${esc(p.id)}"><span class="nom">${esc(p.nom)}</span>
        <span class="preu">${formatEuros(p.preuCents)}</span>${p.charmsInclosos ? `<span class="detall">${p.charmsInclosos} charms inclosos</span>` : ""}</button>`,
      )
      .join("")}
      ${charms.map((p) => `<button type="button" class="producte charm" data-afegeix="${esc(p.id)}"><span class="nom">${esc(p.nom)}</span><span class="preu">${formatEuros(p.preuCents)}</span></button>`).join("")}
      <button type="button" class="producte lliure" data-lliure><span class="nom">Línia lliure</span><span class="detall">Descripció i import</span></button>
    </div></section>
    ${estat.tiquet.length ? htmlTiquet() : '<p class="buit">Toca un producte per començar el tiquet.</p>'}`;
}

function htmlTiquet(): string {
  return `<section aria-label="Tiquet actual" class="tiquet"><h2>Tiquet</h2><ul aria-label="Tiquet">${estat.tiquet
    .map((l, i) => {
      const esCharm = l.pare != null;
      return `<li class="${esCharm ? "linia-charm" : ""}"><div class="linia"><span class="desc">${esCharm ? "＋ " : ""}${esc(l.descripcio)}${l.quantitat > 1 ? ` × ${l.quantitat}` : ""}</span>
        <button type="button" class="boto-preu" data-preu="${i}" aria-label="Canvia el preu: ${formatEuros(l.preuCents * l.quantitat)}">${formatEuros(l.preuCents * l.quantitat)}</button>
        <button type="button" class="boto-treu" data-treu="${i}" aria-label="Treu">✕</button></div>
        ${!esCharm && l.tipus === "producte" ? `<div class="charms"><button type="button" class="boto secundari petit" data-charm="basic" data-linia="${i}">+ charm bàsic</button><button type="button" class="boto secundari petit" data-charm="especial" data-linia="${i}">+ charm especial</button></div>` : ""}
      </li>`;
    })
    .join("")}</ul></section>`;
}

function htmlObrirCaixa(): string {
  if (!estat.dades) {
    return `<div class="targeta" id="sense-dades"><h2>Cal connectar-se</h2>
      <p>Per vendre, cal connectar-se un cop: així l'app descarrega el catàleg i sap qui ven.</p>
      <p>Connecta't a internet i prem «Sincronitzar ara». Després ja es podrà vendre sense connexió.</p></div>`;
  }
  const anterior = caixaActual();
  const avui = diaLocal();
  const esds = estat.dades?.esdeveniments ?? [];
  const perDefecte = esds.find((e) => e.dataInici <= avui && avui <= e.dataFi)?.id ?? "";
  return `${anterior?.tancadaA ? `<p class="nota">L'última caixa d'aquest dispositiu es va tancar el ${dataHora(anterior.tancadaA)}.</p>` : ""}
    <form class="targeta" id="obrir-caixa"><h2>Obrir la caixa</h2>
      <p>Cada dispositiu té la seva caixa. Anota el canvi que tens en efectiu abans de començar.</p>
      <label>Canvi inicial (€)<input name="canvi" inputmode="decimal" autocomplete="off" required placeholder="50"></label>
      <label>Esdeveniment<select name="esdeveniment"><option value="">Cap (venda fora d'esdeveniment)</option>
        ${esds.map((e) => `<option value="${esc(e.id)}" ${e.id === perDefecte ? "selected" : ""}>${esc(e.nom)} (${dataCurta(e.dataInici)})</option>`).join("")}</select></label>
      <button type="submit" class="boto primari">Obrir caixa</button></form>`;
}

function vendesDeCaixa(c: Caixa) {
  return estat.vendes.filter((v) => v.caixaId === c.id);
}

function htmlCaixa(): string {
  const c = caixaActual();
  if (!c) return `<div class="targeta"><h2>Caixa</h2><p>Encara no s'ha obert cap caixa en aquest dispositiu.</p><button type="button" class="boto primari" data-pantalla-anar="vendre">Obrir caixa</button></div>`;
  const vendes = vendesDeCaixa(c);
  const r = resumVendes(vendes, estat.anulacions);
  const cap = `<p>Oberta per ${esc(c.usuariaObertura)} el ${dataHora(c.obertaA)} · canvi inicial ${formatEuros(c.canviInicialCents)}</p>
    <dl class="xifres"><div><dt>Vendes</dt><dd>${r.nombreVendes}</dd></div><div><dt>Efectiu</dt><dd>${formatEuros(r.efectiuCents)}</dd></div><div><dt>Targeta</dt><dd>${formatEuros(r.targetaCents)}</dd></div></dl>`;
  if (c.tancadaA) {
    const t = calculaTancament({ canviInicialCents: c.canviInicialCents, vendes, anulacions: estat.anulacions, recompteEfectiuCents: c.recompteEfectiuCents ?? 0, tpvTargetaCents: c.tpvTargetaCents ?? 0 });
    return `<div class="targeta"><h2>Caixa tancada</h2>${cap}
      <p>Tancada per ${esc(c.usuariaTancament)} el ${dataHora(c.tancadaA)}.</p>
      <dl class="xifres"><div><dt>Efectiu esperat</dt><dd>${formatEuros(t.efectiuEsperatCents)}</dd></div><div><dt>Recompte</dt><dd>${formatEuros(c.recompteEfectiuCents ?? 0)}</dd></div>
      <div><dt>Diferència efectiu</dt><dd class="${t.diferenciaEfectiuCents ? "diferencia" : ""}">${formatEuros(t.diferenciaEfectiuCents)}</dd></div>
      <div><dt>Diferència targeta</dt><dd class="${t.diferenciaTargetaCents ? "diferencia" : ""}">${formatEuros(t.diferenciaTargetaCents)}</dd></div></dl>
      ${c.nota ? `<p class="nota-caixa"><strong>Nota:</strong> ${esc(c.nota)}</p>` : ""}
      <button type="button" class="boto primari" data-pantalla-anar="vendre">Obrir una caixa nova</button></div>`;
  }
  return `<form class="targeta" id="tancar-caixa"><h2>Tancar la caixa</h2>${cap}
    <label>Recompte d'efectiu (€)<input name="recompte" inputmode="decimal" autocomplete="off" required></label>
    <label>Total del TPV (€)<input name="tpv" inputmode="decimal" autocomplete="off" required></label>
    <dl class="xifres" aria-live="polite"><div><dt>Efectiu esperat</dt><dd data-testid="efectiu-esperat">${formatEuros(c.canviInicialCents + r.efectiuCents)}</dd></div>
      <div><dt>Diferència efectiu</dt><dd data-testid="diferencia-efectiu">—</dd></div>
      <div><dt>Targeta esperada</dt><dd>${formatEuros(r.targetaCents)}</dd></div>
      <div><dt>Diferència targeta</dt><dd data-testid="diferencia-targeta">—</dd></div></dl>
    <label>Nota<textarea name="nota" rows="2" placeholder="Opcional: explica la diferència"></textarea></label>
    <button type="submit" class="boto primari">Tancar caixa</button></form>`;
}

function htmlLlistaVendes(vendes: db.AmbSync<Venda>[]): string {
  if (!vendes.length) return '<p class="buit">Encara no hi ha vendes avui en aquest dispositiu.</p>';
  const anul = new Map(estat.anulacions.map((a) => [a.vendaId, a]));
  // Qui ha sincronitzat cada anul·lació (identitat d'Access): només ho sap el servidor.
  const delServidor = new Map((estat.resumServidor?.vendes ?? []).filter((v) => v.anulacio).map((v) => [v.anulacio!.id, v.anulacio!]));
  const registradaPer = (a: Anulacio) => {
    const qui = delServidor.get(a.id)?.registradaPer;
    return qui && qui !== a.usuaria ? ` · registrada per ${esc(qui)}` : "";
  };
  return `<ul aria-label="Vendes del dia" class="vendes">${[...vendes]
    .reverse()
    .map((v) => {
      const a = anul.get(v.id);
      return `<li class="${a ? "anulada" : ""}"><div class="linia"><span><strong>${hora(v.creadaA)}</strong> · ${v.metode === "efectiu" ? "Efectiu" : "Targeta"}${v.sync === 0 ? ' · <span class="pendent">pendent</span>' : v.sync === 2 ? ' · <span class="pendent">error</span>' : ""}</span>
        <strong>${formatEuros(v.totalCents)}</strong></div>
        <p class="detall">${v.linies.map((l) => `${l.pare != null ? "＋ " : ""}${esc(l.descripcio)} ${formatEuros(l.preuCents * l.quantitat)}`).join(" · ")}</p>
        ${a ? `<p class="detall">Anul·lada: ${esc(a.motiu)} · ${esc(a.usuaria)} · ${hora(a.creadaA)}${registradaPer(a)}</p>` : `<button type="button" class="boto secundari petit" data-anula="${esc(v.id)}" aria-label="Anul·lar la venda de ${formatEuros(v.totalCents)} de les ${hora(v.creadaA)}">Anul·lar</button>`}</li>`;
    })
    .join("")}</ul>`;
}

function htmlResum(): string {
  const avui = diaLocal();
  const vendes = estat.vendes.filter((v) => v.dia === avui && v.dispositiuId === estat.dispositiuId);
  const r = resumVendes(vendes, estat.anulacions);
  const s = estat.resumServidor;
  return `<div class="targeta"><h2>Resum del dia · ${dataCurta(avui)}</h2><p>Aquest dispositiu (també sense connexió).</p>
    <dl class="xifres"><div><dt>Vendes</dt><dd>${r.nombreVendes}</dd></div><div><dt>Efectiu</dt><dd data-testid="resum-efectiu">${formatEuros(r.efectiuCents)}</dd></div>
    <div><dt>Targeta</dt><dd data-testid="resum-targeta">${formatEuros(r.targetaCents)}</dd></div><div><dt>Net</dt><dd data-testid="resum-net">${formatEuros(r.netCents)}</dd></div></dl>
    ${r.nombreAnulades ? `<p class="detall">${r.nombreAnulades} ${r.nombreAnulades === 1 ? "venda anul·lada" : "vendes anul·lades"} (no compten).</p>` : ""}</div>
    ${s ? `<div class="targeta"><h2>Totes les caixes d'avui</h2><p>Dades del servidor: suma totes les caixes ja sincronitzades.</p>
      <dl class="xifres"><div><dt>Caixes</dt><dd>${s.nombreCaixes}</dd></div><div><dt>Vendes</dt><dd>${s.nombreVendes}</dd></div><div><dt>Efectiu</dt><dd>${formatEuros(s.efectiuCents)}</dd></div><div><dt>Targeta</dt><dd>${formatEuros(s.targetaCents)}</dd></div><div><dt>Net</dt><dd>${formatEuros(s.netCents)}</dd></div></dl></div>` : ""}
    <h2 class="titol-seccio">Vendes d'avui</h2>${htmlLlistaVendes(vendes)}`;
}

function htmlResumEsdeveniment(id: string): string {
  const f = estat.fitxes[id];
  if (!f) return '<p class="detall">Resum de caixes: encara no consultat (cal connexió).</p>';
  const c = f.caixa;
  return `<h3>Totes les caixes sincronitzades</h3><p class="detall">Consultat el ${dataHora(f.consultadaA)}.</p>
    <dl class="xifres"><div><dt>Vendes</dt><dd data-testid="fira-vendes">${c.nombreVendes}</dd></div><div><dt>Efectiu</dt><dd>${formatEuros(c.efectiuCents)}</dd></div>
    <div><dt>Targeta</dt><dd>${formatEuros(c.targetaCents)}</dd></div><div><dt>Net</dt><dd data-testid="fira-net">${formatEuros(c.netCents)}</dd></div>
    <div><dt>Caixes</dt><dd data-testid="fira-caixes">${c.nombreCaixes}</dd></div></dl>`;
}

function htmlFira(): string {
  const d = estat.dades;
  if (!d) return '<p class="buit">Encara no s\'han descarregat les dades. Connecta\'t i prem «Sincronitzar ara».</p>';
  const PUBLIC: Record<string, string> = { infantil: "Infantil", adult: "Adults", familia: "Família" };
  return `<p class="nota">Dades descarregades el ${dataHora(d.generatA)}.</p>${d.esdeveniments
    .map((e) => {
      const tallers = d.tallers.filter((t) => t.esdevenimentId === e.id);
      return `<section class="targeta" aria-label="${esc(e.nom)}"><h2>${esc(e.nom)}</h2><p>${dataCurta(e.dataInici)}${e.dataFi !== e.dataInici ? ` – ${dataCurta(e.dataFi)}` : ""}${e.ubicacio ? ` · ${esc(e.ubicacio)}` : ""}</p>
        ${e.notes ? `<p class="detall">${esc(e.notes)}</p>` : ""}
        ${htmlResumEsdeveniment(e.id)}
        <ul class="tallers">${tallers
          .map(
            (t) => `<li><div class="linia"><strong>${esc(t.nom)} · ${t.data ? dataCurta(t.data) : "sense data"}</strong><span>${PUBLIC[t.public] ?? esc(t.public)}</span></div>
            <p class="detall">${t.modalitat === "extern" ? `Inscripció externa${t.preuCents != null ? ` (${formatEuros(t.preuCents)}, la cobra l'organització)` : ""}` : "Taller propi"} · <strong>${esc(t.ocupacio)}</strong></p></li>`,
          )
          .join("")}</ul></section>`;
    })
    .join("")}`;
}

function htmlMes(): string {
  const { vendes, altres, errors } = nombrePendents();
  const rebutjades = [...estat.vendes, ...estat.anulacions, ...estat.caixes].filter((x) => x.sync === 2);
  return `<div class="targeta"><h2>Còpia d'emergència</h2>
      <p>${vendes} ${vendes === 1 ? "venda pendent" : "vendes pendents"} i ${altres} altres canvis per sincronitzar. Si el dispositiu no es pot connectar, descarrega'n una còpia i guarda-la.</p>
      <button type="button" class="boto primari" id="copia">Descarregar còpia d'emergència</button></div>
    ${errors ? `<div class="targeta"><h2>Registres amb errors</h2><p>El servidor no els ha acceptat. Es conserven aquí i a la còpia d'emergència.</p><ul>${rebutjades.map((x: any) => `<li>${esc(x.id)}: ${esc((x.errors ?? []).join(", "))}</li>`).join("")}</ul>
      <p>Si s'ha corregit el problema (per exemple, la llista d'usuàries), es poden tornar a enviar.</p>
      <button type="button" class="boto primari" id="torna-enviar">Tornar a enviar</button></div>` : ""}
    <div class="targeta"><h2>Aquest dispositiu</h2>
      <p>Usuària: ${esc(estat.dades?.usuaria ?? "—")}</p>
      <p>Identificador: <code data-testid="dispositiu">${esc(estat.dispositiuId)}</code></p>
      <p>Emmagatzematge: ${estat.persistent ? "persistent ✔" : "<strong>no persistent</strong>: instal·la l'app a la pantalla d'inici perquè Safari no esborri les dades."}</p>
      <p>Dades de consulta: ${estat.dades ? `${estat.dades.cataleg.length} productes, descarregades el ${dataHora(estat.dades.generatA)}` : "encara no descarregades"}</p></div>
    <div class="targeta"><h2>Instal·lar a l'iPad</h2><ol><li>Obre l'app amb Safari.</li><li>Toca Comparteix → «Afegeix a la pantalla d'inici».</li><li>Obre-la sempre des de la icona: així les dades no s'esborren.</li></ol>
      <p>Abans de la fira, obre l'app amb connexió perquè descarregui el catàleg i els tallers.</p></div>`;
}

// ---------- Connexió d'esdeveniments ----------

function connecta(arrel: HTMLElement) {
  arrel.querySelectorAll<HTMLButtonElement>("[data-pantalla-anar]").forEach((b) =>
    b.addEventListener("click", () => {
      estat.pantalla = b.dataset.pantallaAnar as Pantalla;
      dibuixa();
    }),
  );
  arrel.querySelector<HTMLFormElement>("#obrir-caixa")?.addEventListener("submit", (e) => {
    e.preventDefault();
    void obreCaixa(e.currentTarget as HTMLFormElement);
  });

  const cataleg = estat.dades?.cataleg ?? [];
  const perId = (id: string) => cataleg.find((p) => p.id === id)!;
  arrel.querySelectorAll<HTMLButtonElement>("[data-afegeix]").forEach((b) =>
    b.addEventListener("click", () => {
      const p = perId(b.dataset.afegeix!);
      // Un charm tocat des del catàleg s'afegeix a l'últim producte del tiquet, si n'hi ha.
      const ultim = [...estat.tiquet.keys()].reverse().find((i) => estat.tiquet[i].pare == null && estat.tiquet[i].tipus === "producte");
      estat.tiquet = p.tipusCharm && ultim != null ? afegeixCharm(estat.tiquet, ultim, p) : afegeixProducte(estat.tiquet, p);
      dibuixa();
    }),
  );
  arrel.querySelectorAll<HTMLButtonElement>("[data-charm]").forEach((b) =>
    b.addEventListener("click", () => {
      const charm = cataleg.find((p) => p.tipusCharm === b.dataset.charm);
      if (!charm) return;
      estat.tiquet = afegeixCharm(estat.tiquet, Number(b.dataset.linia), charm);
      dibuixa();
    }),
  );
  arrel.querySelectorAll<HTMLButtonElement>("[data-treu]").forEach((b) =>
    b.addEventListener("click", () => {
      estat.tiquet = treuLinia(estat.tiquet, Number(b.dataset.treu));
      dibuixa();
    }),
  );
  arrel.querySelectorAll<HTMLButtonElement>("[data-preu]").forEach((b) =>
    b.addEventListener("click", async () => {
      const i = Number(b.dataset.preu);
      const l = estat.tiquet[i];
      const fd = await dialeg(
        "Preu de la línia",
        `<p>${esc(l.descripcio)}</p><label>Import (€)<input name="import" inputmode="decimal" required value="${formatEuros(l.preuCents).replace(" €", "")}"></label>`,
        "Desar",
      );
      if (!fd) return;
      const cents = eurosACents(String(fd.get("import")));
      if (cents == null) return avisa("L'import no és vàlid.");
      estat.tiquet = canviaPreu(estat.tiquet, i, cents);
      dibuixa();
    }),
  );
  arrel.querySelector("[data-lliure]")?.addEventListener("click", async () => {
    const fd = await dialeg(
      "Línia lliure",
      `<label>Descripció<input name="descripcio" required maxlength="120" autocomplete="off"></label>
       <label>Import (€)<input name="import" inputmode="decimal" required autocomplete="off"></label>`,
      "Afegir",
    );
    if (!fd) return;
    const cents = eurosACents(String(fd.get("import")));
    if (cents == null) return avisa("L'import no és vàlid. Escriu-lo en euros, per exemple 8 o 0,10.");
    estat.tiquet = afegeixLliure(estat.tiquet, String(fd.get("descripcio")).trim(), cents);
    dibuixa();
  });
  arrel.querySelectorAll<HTMLButtonElement>("[data-anula]").forEach((b) =>
    b.addEventListener("click", async () => {
      const fd = await dialeg("Anul·lar la venda", `<p>La venda quedarà registrada com a anul·lada i no comptarà al net.</p><label>Motiu<textarea name="motiu" required rows="2"></textarea></label>`, "Sí, anul·lar");
      const motiu = String(fd?.get("motiu") ?? "").trim();
      if (fd && motiu) await anulaVenda(b.dataset.anula!, motiu);
    }),
  );

  const tancar = arrel.querySelector<HTMLFormElement>("#tancar-caixa");
  if (tancar) {
    const c = caixaOberta()!;
    const actualitza = () => {
      const recompte = eurosACents(tancar.recompte.value);
      const tpv = eurosACents(tancar.tpv.value);
      const t = calculaTancament({ canviInicialCents: c.canviInicialCents, vendes: vendesDeCaixa(c), anulacions: estat.anulacions, recompteEfectiuCents: recompte ?? 0, tpvTargetaCents: tpv ?? 0 });
      $("[data-testid=efectiu-esperat]").textContent = formatEuros(t.efectiuEsperatCents);
      $("[data-testid=diferencia-efectiu]").textContent = recompte == null ? "—" : formatEuros(t.diferenciaEfectiuCents);
      $("[data-testid=diferencia-targeta]").textContent = tpv == null ? "—" : formatEuros(t.diferenciaTargetaCents);
    };
    tancar.addEventListener("input", actualitza);
    tancar.addEventListener("submit", async (e) => {
      e.preventDefault();
      const recompte = eurosACents(tancar.recompte.value);
      const tpv = eurosACents(tancar.tpv.value);
      if (recompte == null || tpv == null) return avisa("Escriu el recompte d'efectiu i el total del TPV en euros.");
      const nota = String(tancar.nota.value ?? "");
      const ok = await dialeg("Tancar la caixa", "<p>Un cop tancada, aquesta caixa ja no admet vendes. Vols tancar-la?</p>", "Sí, tancar");
      if (ok) await tancaCaixa(recompte, tpv, nota);
    });
  }
  arrel.querySelector("#copia")?.addEventListener("click", descarregaCopia);
  arrel.querySelector("#torna-enviar")?.addEventListener("click", () => void tornaAEnviar());
}

function dibuixaCobrament() {
  const lloc = $("#cobrament-lloc");
  if (estat.pantalla !== "vendre" || estat.tiquet.length === 0 || !caixaOberta()) {
    lloc.innerHTML = "";
    document.body.classList.remove("amb-cobrament");
    return;
  }
  document.body.classList.add("amb-cobrament");
  lloc.innerHTML = `<section class="cobrament" role="region" aria-label="Cobrament">
    <div class="total"><span>Total</span><strong>${formatEuros(totalLinies(estat.tiquet))}</strong></div>
    <button type="button" class="boto efectiu" data-cobra="efectiu">Efectiu</button>
    <button type="button" class="boto targeta-pag" data-cobra="targeta">Targeta</button></section>`;
  lloc.querySelectorAll<HTMLButtonElement>("[data-cobra]").forEach((b) =>
    b.addEventListener("click", () => {
      b.disabled = true;
      void cobra(b.dataset.cobra as Metode);
    }),
  );
}

void inicia();
