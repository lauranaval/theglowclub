// Accés a D1: lectura de catàleg i esdeveniments, sincronització idempotent i resums.
import {
  calculaTancament,
  resumVendes,
  validaAnulacio,
  validaCaixa,
  validaVenda,
  type Anulacio,
  type Caixa,
  type Linia,
  type Venda,
} from "../shared/venda";
import type { ProducteCataleg } from "../shared/tiquet";

export const MAX_VENDES_PER_SYNC = 200;

export async function cataleg(db: D1Database): Promise<ProducteCataleg[]> {
  const { results } = await db.prepare("SELECT * FROM productes WHERE actiu = 1 ORDER BY ordre, nom").all<any>();
  return results.map((p) => ({
    id: p.id,
    nom: p.nom,
    categoria: p.categoria,
    preuCents: p.preu_cents,
    charmsInclosos: p.charms_inclosos,
    nota: p.nota,
    unitat: p.unitat,
    tipusCharm: p.tipus_charm,
    actiu: p.actiu === 1,
  }));
}

function ocupacio(t: any): string {
  if (t.modalitat === "extern" && t.recompte == null) return "Ocupació desconeguda";
  if (t.recompte == null) return "Sense dades";
  const data = t.recompte_actualitzat_a ? ` (actualitzat el ${t.recompte_actualitzat_a.slice(0, 10).split("-").reverse().join("/")})` : "";
  return `${t.recompte} inscrites${data}`;
}

export async function esdeveniments(db: D1Database) {
  const [e, t] = await db.batch([
    db.prepare("SELECT * FROM esdeveniments ORDER BY data_inici DESC"),
    db.prepare("SELECT * FROM tallers ORDER BY data, hora_inici, nom"),
  ]);
  return {
    esdeveniments: (e.results as any[]).map((x) => ({
      id: x.id,
      nom: x.nom,
      dataInici: x.data_inici,
      dataFi: x.data_fi,
      ubicacio: x.ubicacio,
      organitzacio: x.organitzacio,
      notes: x.notes,
    })),
    tallers: (t.results as any[]).map((x) => ({
      id: x.id,
      esdevenimentId: x.esdeveniment_id,
      nom: x.nom,
      data: x.data,
      horaInici: x.hora_inici,
      horaFi: x.hora_fi,
      public: x.public,
      modalitat: x.modalitat,
      preuCents: x.preu_cents,
      recompte: x.recompte,
      ocupacio: ocupacio(x),
    })),
  };
}

export interface ResultatSync {
  acceptades: { caixes: string[]; vendes: string[]; anulacions: string[] };
  rebutjades: { tipus: "caixa" | "venda" | "anulacio"; id: string; errors: string[] }[];
}

/**
 * Desa caixes, vendes i anul·lacions enviades per un dispositiu.
 * Idempotent: cada registre porta un id generat al dispositiu i un reenviament no el duplica.
 * Tot s'escriu en un sol batch de D1 (atòmic).
 */
export async function sincronitza(
  db: D1Database,
  qui: string,
  cos: { caixes?: Caixa[]; vendes?: Venda[]; anulacions?: Anulacio[] },
  usuariesPermeses: string[] = [],
): Promise<ResultatSync> {
  // Quan hi ha llista d'usuàries, la usuària que declara el dispositiu ha de ser de l'equip.
  const permesa = (u: unknown) =>
    usuariesPermeses.length === 0 || (typeof u === "string" && usuariesPermeses.includes(u.trim().toLowerCase()));
  const caixes = Array.isArray(cos.caixes) ? cos.caixes : [];
  const vendes = Array.isArray(cos.vendes) ? cos.vendes.slice(0, MAX_VENDES_PER_SYNC) : [];
  const anulacions = Array.isArray(cos.anulacions) ? cos.anulacions : [];
  const ara = new Date().toISOString();
  const res: ResultatSync = { acceptades: { caixes: [], vendes: [], anulacions: [] }, rebutjades: [] };

  // Referències existents per evitar errors de clau forana que farien fallar tot el batch.
  const [prods, esds] = await db.batch([db.prepare("SELECT id FROM productes"), db.prepare("SELECT id FROM esdeveniments")]);
  const producteIds = new Set((prods.results as any[]).map((r) => r.id));
  const esdIds = new Set((esds.results as any[]).map((r) => r.id));
  const caixesConegudes = await idsExistents(db, "caixes", [...caixes.map((c) => c?.id), ...vendes.map((v) => v?.caixaId)]);
  const vendesConegudes = await idsExistents(db, "vendes", anulacions.map((a) => a?.vendaId));
  const anulacioDeVenda = await anulacionsExistents(db, anulacions.map((a) => a?.vendaId));

  const sentencies: D1PreparedStatement[] = [];

  for (const c of caixes) {
    const errors = validaCaixa(c);
    if (c?.esdevenimentId != null && !esdIds.has(c.esdevenimentId)) errors.push("esdeveniment desconegut");
    if (!permesa(c?.usuariaObertura) || (c?.tancadaA != null && !permesa(c.usuariaTancament))) errors.push("usuària no permesa");
    if (errors.length) {
      res.rebutjades.push({ tipus: "caixa", id: String(c?.id), errors });
      continue;
    }
    sentencies.push(
      db
        .prepare(
          `INSERT INTO caixes (id, dispositiu_id, esdeveniment_id, dia, oberta_a, canvi_inicial_cents, usuaria_obertura,
             tancada_a, recompte_efectiu_cents, tpv_targeta_cents, nota, usuaria_tancament, registrada_a, registrada_per)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
           ON CONFLICT (id) DO UPDATE SET
             tancada_a = excluded.tancada_a,
             recompte_efectiu_cents = excluded.recompte_efectiu_cents,
             tpv_targeta_cents = excluded.tpv_targeta_cents,
             nota = excluded.nota,
             usuaria_tancament = excluded.usuaria_tancament
           WHERE caixes.tancada_a IS NULL AND excluded.tancada_a IS NOT NULL`,
        )
        .bind(
          c.id,
          c.dispositiuId,
          c.esdevenimentId ?? null,
          c.dia,
          c.obertaA,
          c.canviInicialCents,
          c.usuariaObertura,
          c.tancadaA ?? null,
          c.tancadaA ? c.recompteEfectiuCents : null,
          c.tancadaA ? c.tpvTargetaCents : null,
          c.tancadaA ? (c.nota ?? null) : null,
          c.tancadaA ? c.usuariaTancament : null,
          ara,
          qui,
        ),
    );
    caixesConegudes.add(c.id);
    res.acceptades.caixes.push(c.id);
  }

  const vendesAcceptades = new Set<string>();
  for (const v of vendes) {
    const errors = validaVenda(v);
    if (errors.length === 0) {
      if (!caixesConegudes.has(v.caixaId)) errors.push("caixa desconeguda");
      if (!permesa(v.usuaria)) errors.push("usuària no permesa");
      if (v.esdevenimentId != null && !esdIds.has(v.esdevenimentId)) errors.push("esdeveniment desconegut");
      v.linies.forEach((l, i) => {
        if (l.tipus === "producte" && !producteIds.has(l.producteId)) errors.push(`línia ${i + 1}: producte desconegut`);
      });
    }
    if (errors.length) {
      res.rebutjades.push({ tipus: "venda", id: String(v?.id), errors });
      continue;
    }
    sentencies.push(
      db
        .prepare(
          `INSERT INTO vendes (id, caixa_id, dispositiu_id, esdeveniment_id, dia, creada_a, metode, total_cents, usuaria, registrada_a, registrada_per)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) ON CONFLICT DO NOTHING`,
        )
        .bind(v.id, v.caixaId, v.dispositiuId, v.esdevenimentId ?? null, v.dia, v.creadaA, v.metode, v.totalCents, v.usuaria, ara, qui),
    );
    v.linies.forEach((l: Linia, i) => {
      sentencies.push(
        db
          .prepare(
            `INSERT INTO linies_venda (venda_id, posicio, pare, tipus, producte_id, descripcio, preu_cents, quantitat)
             SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
             WHERE NOT EXISTS (SELECT 1 FROM linies_venda WHERE venda_id = ?1 AND posicio = ?2)`,
          )
          .bind(v.id, i, l.pare ?? null, l.tipus, l.tipus === "producte" ? l.producteId : null, l.descripcio, l.preuCents, l.quantitat),
      );
    });
    vendesAcceptades.add(v.id);
    res.acceptades.vendes.push(v.id);
  }

  for (const a of anulacions) {
    const errors = validaAnulacio(a);
    if (errors.length === 0 && !vendesConegudes.has(a.vendaId) && !vendesAcceptades.has(a.vendaId)) {
      errors.push("venda desconeguda");
    }
    if (errors.length === 0 && !permesa(a.usuaria)) errors.push("usuària no permesa");
    // Una venda només es pot anul·lar una vegada. El mateix id és un reenviament i s'accepta.
    if (errors.length === 0) {
      const ja = anulacioDeVenda.get(a.vendaId);
      if (ja && ja !== a.id) errors.push("la venda ja estava anul·lada");
      else anulacioDeVenda.set(a.vendaId, a.id);
    }
    if (errors.length) {
      res.rebutjades.push({ tipus: "anulacio", id: String(a?.id), errors });
      continue;
    }
    sentencies.push(
      db
        .prepare(
          `INSERT INTO anulacions (id, venda_id, motiu, usuaria, creada_a, registrada_a, registrada_per)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT DO NOTHING`,
        )
        .bind(a.id, a.vendaId, a.motiu.trim(), a.usuaria, a.creadaA, ara, qui),
    );
    res.acceptades.anulacions.push(a.id);
  }

  if (sentencies.length) await db.batch(sentencies);

  // Dues peticions simultànies poden passar totes dues la comprovació prèvia; la inserció és ON CONFLICT DO NOTHING.
  // El resultat ha de reflectir el que realment ha quedat desat: es torna a llegir l'anul·lació de cada venda.
  if (res.acceptades.anulacions.length) {
    const vendaDe = new Map(anulacions.filter((a) => res.acceptades.anulacions.includes(a?.id)).map((a) => [a.id, a.vendaId]));
    const desades = await anulacionsExistents(db, [...vendaDe.values()]);
    res.acceptades.anulacions = res.acceptades.anulacions.filter((id) => {
      if (desades.get(vendaDe.get(id)!) === id) return true;
      res.rebutjades.push({ tipus: "anulacio", id, errors: ["la venda ja estava anul·lada"] });
      return false;
    });
  }
  return res;
}

async function anulacionsExistents(db: D1Database, vendaIds: unknown[]): Promise<Map<string, string>> {
  const unics = [...new Set(vendaIds.filter((x): x is string => typeof x === "string"))];
  const mapa = new Map<string, string>();
  for (let i = 0; i < unics.length; i += 90) {
    const tros = unics.slice(i, i + 90);
    const { results } = await db
      .prepare(`SELECT id, venda_id FROM anulacions WHERE venda_id IN (${tros.map(() => "?").join(",")})`)
      .bind(...tros)
      .all<{ id: string; venda_id: string }>();
    results.forEach((r) => mapa.set(r.venda_id, r.id));
  }
  return mapa;
}

async function idsExistents(db: D1Database, taula: "caixes" | "vendes", ids: unknown[]): Promise<Set<string>> {
  const unics = [...new Set(ids.filter((x): x is string => typeof x === "string"))];
  const trobats = new Set<string>();
  for (let i = 0; i < unics.length; i += 90) {
    const tros = unics.slice(i, i + 90);
    const { results } = await db
      .prepare(`SELECT id FROM ${taula} WHERE id IN (${tros.map(() => "?").join(",")})`)
      .bind(...tros)
      .all<{ id: string }>();
    results.forEach((r) => trobats.add(r.id));
  }
  return trobats;
}

export interface FiltreResum {
  dia?: string | null;
  esdeveniment?: string | null;
  dispositiu?: string | null;
}

/** Resum de vendes i caixes (totes les caixes sincronitzades que compleixen el filtre). */
export async function resum(db: D1Database, f: FiltreResum) {
  const condicions: string[] = [];
  const valors: string[] = [];
  if (f.dia) {
    condicions.push(`dia = ?${valors.push(f.dia)}`);
  }
  if (f.esdeveniment) {
    condicions.push(`esdeveniment_id = ?${valors.push(f.esdeveniment)}`);
  }
  if (f.dispositiu) {
    condicions.push(`dispositiu_id = ?${valors.push(f.dispositiu)}`);
  }
  const on = condicions.length ? `WHERE ${condicions.join(" AND ")}` : "";
  const [rv, rl, ra, rc] = await db.batch([
    db.prepare(`SELECT * FROM vendes ${on} ORDER BY creada_a`).bind(...valors),
    db
      .prepare(`SELECT * FROM linies_venda WHERE venda_id IN (SELECT id FROM vendes ${on}) ORDER BY venda_id, posicio`)
      .bind(...valors),
    db.prepare(`SELECT * FROM anulacions WHERE venda_id IN (SELECT id FROM vendes ${on})`).bind(...valors),
    db.prepare(`SELECT * FROM caixes ${on} ORDER BY oberta_a`).bind(...valors),
  ]);

  const linies = new Map<string, Linia[]>();
  for (const l of rl.results as any[]) {
    const llista = linies.get(l.venda_id) ?? [];
    llista.push({
      tipus: l.tipus,
      producteId: l.producte_id,
      descripcio: l.descripcio,
      preuCents: l.preu_cents,
      quantitat: l.quantitat,
      pare: l.pare,
    });
    linies.set(l.venda_id, llista);
  }
  const anulacions: (Anulacio & { registradaPer: string })[] = (ra.results as any[]).map((a) => ({
    id: a.id,
    vendaId: a.venda_id,
    motiu: a.motiu,
    usuaria: a.usuaria,
    creadaA: a.creada_a,
    registradaPer: a.registrada_per as string,
  }));
  const perVenda = new Map(anulacions.map((a) => [a.vendaId, a]));
  const vendes: (Venda & { registradaPer: string })[] = (rv.results as any[]).map((v) => ({
    id: v.id,
    caixaId: v.caixa_id,
    dispositiuId: v.dispositiu_id,
    esdevenimentId: v.esdeveniment_id,
    dia: v.dia,
    creadaA: v.creada_a,
    metode: v.metode,
    linies: linies.get(v.id) ?? [],
    totalCents: v.total_cents,
    usuaria: v.usuaria,
    registradaPer: v.registrada_per as string,
  }));

  const caixes = (rc.results as any[]).map((c) => {
    const caixa: Caixa = {
      id: c.id,
      dispositiuId: c.dispositiu_id,
      esdevenimentId: c.esdeveniment_id,
      dia: c.dia,
      obertaA: c.oberta_a,
      canviInicialCents: c.canvi_inicial_cents,
      usuariaObertura: c.usuaria_obertura,
      tancadaA: c.tancada_a,
      recompteEfectiuCents: c.recompte_efectiu_cents,
      tpvTargetaCents: c.tpv_targeta_cents,
      nota: c.nota,
      usuariaTancament: c.usuaria_tancament,
    };
    const deLaCaixa = vendes.filter((v) => v.caixaId === caixa.id);
    const r = resumVendes(deLaCaixa, anulacions);
    const tancament =
      caixa.tancadaA != null
        ? calculaTancament({
            canviInicialCents: caixa.canviInicialCents,
            vendes: deLaCaixa,
            anulacions,
            recompteEfectiuCents: caixa.recompteEfectiuCents ?? 0,
            tpvTargetaCents: caixa.tpvTargetaCents ?? 0,
          })
        : null;
    return { ...caixa, registradaPer: c.registrada_per as string, ...r, ...(tancament ?? {}) };
  });

  return {
    ...resumVendes(vendes, anulacions),
    nombreCaixes: caixes.length,
    caixes,
    vendes: vendes.map((v) => ({ ...v, anulacio: perVenda.get(v.id) ?? null })),
  };
}

export async function fitxaEsdeveniment(db: D1Database, id: string) {
  const e = await db.prepare("SELECT * FROM esdeveniments WHERE id = ?").bind(id).first<any>();
  if (!e) return null;
  const { tallers } = await esdeveniments(db);
  const r = await resum(db, { esdeveniment: id });
  return {
    id: e.id,
    nom: e.nom,
    dataInici: e.data_inici,
    dataFi: e.data_fi,
    ubicacio: e.ubicacio,
    organitzacio: e.organitzacio,
    notes: e.notes,
    tallers: tallers.filter((t) => t.esdevenimentId === id),
    // Inscripcions de tallers externs: les cobra l'organització; mai no entren a la caixa ni als pendents de Glow.
    pendentsCents: 0,
    caixa: {
      nombreVendes: r.nombreVendes,
      nombreAnulades: r.nombreAnulades,
      efectiuCents: r.efectiuCents,
      targetaCents: r.targetaCents,
      netCents: r.netCents,
      nombreCaixes: r.nombreCaixes,
    },
  };
}
