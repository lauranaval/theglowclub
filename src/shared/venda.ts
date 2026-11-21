// Model de vendes, anul·lacions i caixes, comú al servidor i al dispositiu.
import { esCentsValids } from "./diners";
import { totalLinies } from "./tiquet";

export type Metode = "efectiu" | "targeta";

export interface Linia {
  tipus: "producte" | "lliure";
  producteId: string | null;
  descripcio: string;
  preuCents: number;
  quantitat: number;
  /** Posició de la línia de producte a la qual s'ha afegit aquest charm. */
  pare: number | null;
}

export interface Venda {
  id: string;
  caixaId: string;
  dispositiuId: string;
  esdevenimentId: string | null;
  dia: string;
  creadaA: string;
  metode: Metode;
  linies: Linia[];
  totalCents: number;
  usuaria: string;
}

export interface Anulacio {
  id: string;
  vendaId: string;
  motiu: string;
  usuaria: string;
  creadaA: string;
}

export interface Caixa {
  id: string;
  dispositiuId: string;
  esdevenimentId: string | null;
  dia: string;
  obertaA: string;
  canviInicialCents: number;
  usuariaObertura: string;
  tancadaA: string | null;
  recompteEfectiuCents: number | null;
  tpvTargetaCents: number | null;
  nota: string | null;
  usuariaTancament: string | null;
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[A-Za-z0-9_-]{8,64}$/;

function esData(s: unknown): s is string {
  return typeof s === "string" && !Number.isNaN(Date.parse(s));
}
function esText(s: unknown, max = 200): s is string {
  return typeof s === "string" && s.trim().length > 0 && s.length <= max;
}

export function validaVenda(v: Venda): string[] {
  const e: string[] = [];
  if (!ID.test(String(v?.id))) e.push("id no vàlid");
  if (!ID.test(String(v?.caixaId))) e.push("caixa no vàlida");
  if (!esText(v?.dispositiuId, 64)) e.push("dispositiu no vàlid");
  if (!DIA.test(String(v?.dia))) e.push("dia no vàlid");
  if (!esData(v?.creadaA)) e.push("data no vàlida");
  if (v?.metode !== "efectiu" && v?.metode !== "targeta") e.push("mètode no vàlid");
  if (!esText(v?.usuaria)) e.push("usuària no vàlida");
  if (!Array.isArray(v?.linies) || v.linies.length === 0 || v.linies.length > 100) {
    e.push("cal com a mínim una línia");
    return e;
  }
  v.linies.forEach((l, i) => {
    if (l.tipus !== "producte" && l.tipus !== "lliure") e.push(`línia ${i + 1}: tipus no vàlid`);
    if (!esText(l.descripcio)) e.push(`línia ${i + 1}: falta la descripció`);
    if (!esCentsValids(l.preuCents)) e.push(`línia ${i + 1}: import no vàlid`);
    if (!Number.isSafeInteger(l.quantitat) || l.quantitat < 1) e.push(`línia ${i + 1}: quantitat no vàlida`);
    if (l.tipus === "producte" && !esText(l.producteId, 64)) e.push(`línia ${i + 1}: falta el producte`);
    if (l.pare != null && (!Number.isInteger(l.pare) || l.pare < 0 || l.pare >= i || v.linies[l.pare].pare != null)) {
      e.push(`línia ${i + 1}: charm sense producte`);
    }
  });
  if (!esCentsValids(v.totalCents)) e.push("total no vàlid");
  else if (e.length === 0 && totalLinies(v.linies) !== v.totalCents) e.push("el total no quadra amb les línies");
  return e;
}

export function validaAnulacio(a: Anulacio): string[] {
  const e: string[] = [];
  if (!ID.test(String(a?.id))) e.push("id no vàlid");
  if (!ID.test(String(a?.vendaId))) e.push("venda no vàlida");
  if (!esText(a?.motiu)) e.push("cal indicar el motiu");
  if (!esText(a?.usuaria)) e.push("usuària no vàlida");
  if (!esData(a?.creadaA)) e.push("data no vàlida");
  return e;
}

export function validaCaixa(c: Caixa): string[] {
  const e: string[] = [];
  if (!ID.test(String(c?.id))) e.push("id no vàlid");
  if (!esText(c?.dispositiuId, 64)) e.push("dispositiu no vàlid");
  if (!DIA.test(String(c?.dia))) e.push("dia no vàlid");
  if (!esData(c?.obertaA)) e.push("data d'obertura no vàlida");
  if (!esCentsValids(c?.canviInicialCents)) e.push("canvi inicial no vàlid");
  if (!esText(c?.usuariaObertura)) e.push("usuària no vàlida");
  if (c?.tancadaA != null) {
    if (!esData(c.tancadaA)) e.push("data de tancament no vàlida");
    if (!esCentsValids(c.recompteEfectiuCents)) e.push("recompte d'efectiu no vàlid");
    if (!esCentsValids(c.tpvTargetaCents)) e.push("total del TPV no vàlid");
    if (!esText(c.usuariaTancament)) e.push("usuària de tancament no vàlida");
    if (c.nota != null && (typeof c.nota !== "string" || c.nota.length > 1000)) e.push("nota massa llarga");
  }
  return e;
}

export interface ResumVendes {
  nombreVendes: number;
  nombreAnulades: number;
  efectiuCents: number;
  targetaCents: number;
  netCents: number;
}

/** Resum net: les vendes anul·lades no compten. */
export function resumVendes(vendes: Venda[], anulacions: Pick<Anulacio, "vendaId">[]): ResumVendes {
  const anulades = new Set(anulacions.map((a) => a.vendaId));
  const r: ResumVendes = { nombreVendes: 0, nombreAnulades: 0, efectiuCents: 0, targetaCents: 0, netCents: 0 };
  for (const v of vendes) {
    if (anulades.has(v.id)) {
      r.nombreAnulades++;
      continue;
    }
    r.nombreVendes++;
    if (v.metode === "efectiu") r.efectiuCents += v.totalCents;
    else r.targetaCents += v.totalCents;
  }
  r.netCents = r.efectiuCents + r.targetaCents;
  return r;
}

export interface CalculTancament {
  efectiuEsperatCents: number;
  diferenciaEfectiuCents: number;
  targetaEsperadaCents: number;
  diferenciaTargetaCents: number;
}

/** Efectiu esperat = canvi inicial + vendes en efectiu no anul·lades. Diferència = recompte − esperat. */
export function calculaTancament(d: {
  canviInicialCents: number;
  vendes: Venda[];
  anulacions: Pick<Anulacio, "vendaId">[];
  recompteEfectiuCents: number;
  tpvTargetaCents: number;
}): CalculTancament {
  const r = resumVendes(d.vendes, d.anulacions);
  const efectiuEsperatCents = d.canviInicialCents + r.efectiuCents;
  return {
    efectiuEsperatCents,
    diferenciaEfectiuCents: d.recompteEfectiuCents - efectiuEsperatCents,
    targetaEsperadaCents: r.targetaCents,
    diferenciaTargetaCents: d.tpvTargetaCents - r.targetaCents,
  };
}

/** Dia local (aaaa-mm-dd) d'una data, a la zona horària del dispositiu. */
export function diaLocal(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
