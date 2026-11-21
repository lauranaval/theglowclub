// Proves afegides arran de la revisió independent del bloc 1 (21/11/2026).
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { crida, lliure, novaCaixa, novaVenda, simulaCertificatsAccess, sincronitza } from "./ajuda";

async function nouEsdeveniment(id: string) {
  await env.DB.prepare("INSERT INTO esdeveniments (id, nom, data_inici, data_fi) VALUES (?1, ?2, '2027-01-10', '2027-01-11')")
    .bind(id, `Prova ${id}`)
    .run();
}

describe("Revisió independent · identitat de la usuària", () => {
  beforeEach(simulaCertificatsAccess);

  it("F-06 una anul·lació amb una usuària que no és de l'equip es rebutja", async () => {
    const caixa = novaCaixa("disp-rev-u1");
    const v = novaVenda(caixa, "efectiu", [lliure(1700)]);
    await sincronitza({ dispositiuId: caixa.dispositiuId, caixes: [caixa], vendes: [v] });
    const intrusa = { id: crypto.randomUUID(), vendaId: v.id, motiu: "prova", usuaria: "intrusa@example.test", creadaA: "2026-12-05T10:05:00.000Z" };
    const { cos } = await sincronitza({ dispositiuId: caixa.dispositiuId, anulacions: [intrusa] });
    expect(cos.rebutjades.map((r: any) => r.id)).toEqual([intrusa.id]);
    expect(cos.rebutjades[0].errors.join(" ")).toMatch(/usuària/);
  });

  it("F-06 vendes i caixes amb una usuària que no és de l'equip es rebutgen", async () => {
    const caixa = novaCaixa("disp-rev-u2", 0, { usuariaObertura: "intrusa@example.test" });
    const bona = novaCaixa("disp-rev-u2");
    const v = novaVenda(bona, "efectiu", [lliure(500)], { usuaria: "intrusa@example.test" });
    const { cos } = await sincronitza({ dispositiuId: "disp-rev-u2", caixes: [caixa, bona], vendes: [v] });
    expect(cos.rebutjades.map((r: any) => r.id).sort()).toEqual([caixa.id, v.id].sort());
  });

  it("F-06 el resum diu qui ha sincronitzat cada registre (identitat d'Access verificada)", async () => {
    const caixa = novaCaixa("disp-rev-u3");
    const v = novaVenda(caixa, "efectiu", [lliure(1700)]);
    await sincronitza({ dispositiuId: caixa.dispositiuId, caixes: [caixa], vendes: [v] }, "sandra@example.test");
    const a = { id: crypto.randomUUID(), vendaId: v.id, motiu: "duplicada", usuaria: "laura@example.test", creadaA: "2026-12-05T10:05:00.000Z" };
    await sincronitza({ dispositiuId: caixa.dispositiuId, anulacions: [a] }, "elena@example.test");
    const resum = (await (await crida("/api/resum?dispositiu=disp-rev-u3")).json()) as any;
    expect(resum.vendes[0].registradaPer).toBe("sandra@example.test");
    expect(resum.vendes[0].anulacio.registradaPer).toBe("elena@example.test");
    expect(resum.caixes[0].registradaPer).toBe("sandra@example.test");
  });
});

describe("Revisió independent · anul·lacions duplicades", () => {
  beforeEach(simulaCertificatsAccess);

  it("F-06 dos dispositius anul·len la mateixa venda: la segona es rebutja; un reenviament de la primera s'accepta", async () => {
    const caixa = novaCaixa("disp-rev-a1");
    const v = novaVenda(caixa, "efectiu", [lliure(1700)]);
    await sincronitza({ dispositiuId: caixa.dispositiuId, caixes: [caixa], vendes: [v] });
    const primera = { id: crypto.randomUUID(), vendaId: v.id, motiu: "duplicada", usuaria: "laura@example.test", creadaA: "2026-12-05T10:05:00.000Z" };
    const segona = { id: crypto.randomUUID(), vendaId: v.id, motiu: "error de preu", usuaria: "elena@example.test", creadaA: "2026-12-05T10:06:00.000Z" };
    expect((await sincronitza({ dispositiuId: "disp-rev-a1", anulacions: [primera] })).cos.rebutjades).toEqual([]);
    const { cos } = await sincronitza({ dispositiuId: "disp-rev-a1-b", anulacions: [segona] }, "elena@example.test");
    expect(cos.acceptades.anulacions).toEqual([]);
    expect(cos.rebutjades).toEqual([{ tipus: "anulacio", id: segona.id, errors: ["la venda ja estava anul·lada"] }]);
    const reenviada = await sincronitza({ dispositiuId: "disp-rev-a1", anulacions: [primera] });
    expect(reenviada.cos.acceptades.anulacions).toEqual([primera.id]);
    expect(reenviada.cos.rebutjades).toEqual([]);
  });

  it("F-06 dos dispositius anul·len la mateixa venda alhora: exactament una acceptada i l'altra rebutjada", async () => {
    const caixa = novaCaixa("disp-rev-a3");
    const v = novaVenda(caixa, "efectiu", [lliure(1700)]);
    await sincronitza({ dispositiuId: caixa.dispositiuId, caixes: [caixa], vendes: [v] });
    const deA = { id: crypto.randomUUID(), vendaId: v.id, motiu: "duplicada", usuaria: "laura@example.test", creadaA: "2026-12-05T10:05:00.000Z" };
    const deB = { id: crypto.randomUUID(), vendaId: v.id, motiu: "error de preu", usuaria: "elena@example.test", creadaA: "2026-12-05T10:06:00.000Z" };
    const [ra, rb] = await Promise.all([
      sincronitza({ dispositiuId: "disp-rev-a3", anulacions: [deA] }),
      sincronitza({ dispositiuId: "disp-rev-a3-b", anulacions: [deB] }, "elena@example.test"),
    ]);
    const acceptades = [...ra.cos.acceptades.anulacions, ...rb.cos.acceptades.anulacions];
    const rebutjades = [...ra.cos.rebutjades, ...rb.cos.rebutjades];
    expect(acceptades).toHaveLength(1);
    expect(rebutjades).toHaveLength(1);
    expect(rebutjades[0].errors).toEqual(["la venda ja estava anul·lada"]);
    const desada = await env.DB.prepare("SELECT id FROM anulacions WHERE venda_id = ?").bind(v.id).first<{ id: string }>();
    expect(desada?.id).toBe(acceptades[0]);
    expect(rebutjades[0].id).not.toBe(acceptades[0]);
  });

  it("F-06 dues anul·lacions de la mateixa venda dins del mateix lot: només s'accepta la primera", async () => {
    const caixa = novaCaixa("disp-rev-a2");
    const v = novaVenda(caixa, "efectiu", [lliure(900)]);
    const a1 = { id: crypto.randomUUID(), vendaId: v.id, motiu: "u", usuaria: "laura@example.test", creadaA: "2026-12-05T10:05:00.000Z" };
    const a2 = { ...a1, id: crypto.randomUUID(), motiu: "dos" };
    const { cos } = await sincronitza({ dispositiuId: "disp-rev-a2", caixes: [caixa], vendes: [v], anulacions: [a1, a2] });
    expect(cos.acceptades.anulacions).toEqual([a1.id]);
    expect(cos.rebutjades.map((r: any) => r.id)).toEqual([a2.id]);
  });
});

describe("Revisió independent · resum d'esdeveniment amb dades pròpies", () => {
  beforeEach(simulaCertificatsAccess);

  it("F-12 fitxa de l'esdeveniment amb dos dispositius en dies diferents: 5 vendes, 65 € i 2 caixes", async () => {
    const esd = `esd-f12-${crypto.randomUUID().slice(0, 8)}`;
    await nouEsdeveniment(esd);
    const a = novaCaixa("disp-rev-f12-a", 0, { esdevenimentId: esd, dia: "2027-01-10" });
    const b = novaCaixa("disp-rev-f12-b", 0, { esdevenimentId: esd, dia: "2027-01-11", usuariaObertura: "sandra@example.test" });
    const vA = [1500, 1500, 1000].map((c) => novaVenda(a, "efectiu", [lliure(c)]));
    const vB = [1200, 1300].map((c) => novaVenda(b, "targeta", [lliure(c)], { usuaria: "sandra@example.test" }));
    await sincronitza({ dispositiuId: a.dispositiuId, caixes: [a], vendes: vA });
    await sincronitza({ dispositiuId: b.dispositiuId, caixes: [b], vendes: vB }, "sandra@example.test");
    const fitxa = (await (await crida(`/api/esdeveniments/${esd}`)).json()) as any;
    expect(fitxa.caixa).toEqual({ nombreVendes: 5, nombreAnulades: 0, efectiuCents: 4000, targetaCents: 2500, netCents: 6500, nombreCaixes: 2 });
  });

  it("F-13 esdeveniment amb 4 tallers externs sense recompte i vendes de paradeta: la caixa només suma les vendes", async () => {
    const esd = `esd-f13-${crypto.randomUUID().slice(0, 8)}`;
    await nouEsdeveniment(esd);
    const tallers = [
      ["infantil", 1000],
      ["adult", 1500],
      ["infantil", 1000],
      ["adult", 1500],
    ] as const;
    for (const [i, [pub, preu]] of tallers.entries()) {
      await env.DB.prepare("INSERT INTO tallers (id, esdeveniment_id, nom, data, public, modalitat, preu_cents) VALUES (?1, ?2, 'Taller', '2027-01-10', ?3, 'extern', ?4)")
        .bind(`${esd}-t${i}`, esd, pub, preu)
        .run();
    }
    const caixa = novaCaixa("disp-rev-f13", 0, { esdevenimentId: esd, dia: "2027-01-10" });
    const vendes = [novaVenda(caixa, "efectiu", [lliure(1700)]), novaVenda(caixa, "targeta", [lliure(500)])];
    await sincronitza({ dispositiuId: caixa.dispositiuId, caixes: [caixa], vendes });
    const fitxa = (await (await crida(`/api/esdeveniments/${esd}`)).json()) as any;
    expect(fitxa.tallers).toHaveLength(4);
    expect(fitxa.tallers.every((t: any) => t.ocupacio === "Ocupació desconeguda")).toBe(true);
    expect(fitxa.pendentsCents).toBe(0);
    expect(fitxa.caixa).toMatchObject({ nombreVendes: 2, efectiuCents: 1700, targetaCents: 500, netCents: 2200, nombreCaixes: 1 });
  });
});
