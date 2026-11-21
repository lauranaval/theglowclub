// Construcció del tiquet de venda. Funcions pures: no modifiquen la llista que reben.
import type { Linia } from "./venda";

export interface ProducteCataleg {
  id: string;
  nom: string;
  categoria: string;
  preuCents: number;
  charmsInclosos: number;
  nota: string | null;
  unitat: "unitat" | "parell";
  tipusCharm: "basic" | "especial" | null;
  actiu: boolean;
}

export function afegeixProducte(linies: Linia[], p: ProducteCataleg): Linia[] {
  return [
    ...linies,
    { tipus: "producte", producteId: p.id, descripcio: p.nom, preuCents: p.preuCents, quantitat: 1, pare: null },
  ];
}

/** Afegeix un charm extra (bàsic o especial) a la línia de producte `indexPare`. */
export function afegeixCharm(linies: Linia[], indexPare: number, charm: ProducteCataleg): Linia[] {
  const pare = linies[indexPare];
  if (!pare || pare.pare != null) throw new Error("El charm s'ha d'afegir a una línia de producte");
  const nova: Linia = {
    tipus: "producte",
    producteId: charm.id,
    descripcio: charm.nom,
    preuCents: charm.preuCents,
    quantitat: 1,
    pare: indexPare,
  };
  // Els charms van just després del producte i dels charms que ja té.
  let pos = indexPare + 1;
  while (pos < linies.length && linies[pos].pare === indexPare) pos++;
  return reindexa([...linies.slice(0, pos), nova, ...linies.slice(pos)], pos);
}

export function afegeixLliure(linies: Linia[], descripcio: string, preuCents: number, quantitat = 1): Linia[] {
  return [...linies, { tipus: "lliure", producteId: null, descripcio, preuCents, quantitat, pare: null }];
}

/** Treu una línia; si és un producte, treu també els seus charms. */
export function treuLinia(linies: Linia[], index: number): Linia[] {
  const fora = new Set<number>([index]);
  linies.forEach((l, i) => {
    if (l.pare === index) fora.add(i);
  });
  const mapa = new Map<number, number>();
  const resultat: Linia[] = [];
  linies.forEach((l, i) => {
    if (fora.has(i)) return;
    mapa.set(i, resultat.length);
    resultat.push({ ...l });
  });
  return resultat.map((l) => (l.pare == null ? l : { ...l, pare: mapa.get(l.pare) ?? null }));
}

/** Canvia el preu cobrat d'una línia (la venda desa el preu realment cobrat). */
export function canviaPreu(linies: Linia[], index: number, preuCents: number): Linia[] {
  return linies.map((l, i) => (i === index ? { ...l, preuCents } : l));
}

export function totalLinies(linies: Linia[]): number {
  return linies.reduce((s, l) => s + l.preuCents * l.quantitat, 0);
}

// Després d'inserir una línia a la posició `inserida`, els índexs `pare` iguals o superiors avancen una posició.
function reindexa(linies: Linia[], inserida: number): Linia[] {
  return linies.map((l, i) => {
    if (i === inserida || l.pare == null) return l;
    return l.pare >= inserida ? { ...l, pare: l.pare + 1 } : l;
  });
}
