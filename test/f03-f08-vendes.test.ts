import { beforeEach, describe, expect, it } from "vitest";
import { crida, lliure, novaCaixa, novaVenda, simulaCertificatsAccess, sincronitza } from "./ajuda";
import { afegeixCharm, afegeixLliure, afegeixProducte, totalLinies, treuLinia } from "../src/shared/tiquet";
import { eurosACents, formatEuros } from "../src/shared/diners";
import { resumVendes } from "../src/shared/venda";

async function cataleg() {
  const r = await crida("/api/dades");
  const { cataleg } = (await r.json()) as { cataleg: any[] };
  const per = (id: string) => cataleg.find((p) => p.id === id)!;
  return { cataleg, per };
}

describe("Vendes de paradeta", () => {
  beforeEach(simulaCertificatsAccess);

  it("F-03 polsera d'eslabons + charm especial + charm bàsic en efectiu: 17,00 € amb desglossament 12 + 3 + 2", async () => {
    const { per } = await cataleg();
    let linies = afegeixProducte([], per("polsera-eslabons"));
    linies = afegeixCharm(linies, 0, per("charm-especial"));
    linies = afegeixCharm(linies, 0, per("charm-basic"));
    expect(linies.map((l) => l.preuCents)).toEqual([1200, 300, 200]);
    expect(linies[1].pare).toBe(0);
    expect(totalLinies(linies)).toBe(1700);
    expect(formatEuros(totalLinies(linies))).toBe("17,00 €");

    const caixa = novaCaixa("disp-f03");
    const venda = novaVenda(caixa, "efectiu", linies);
    const { status, cos } = await sincronitza({ dispositiuId: "disp-f03", caixes: [caixa], vendes: [venda] });
    expect(status).toBe(200);
    expect(cos.rebutjades).toEqual([]);

    const resum = (await (await crida("/api/resum?dispositiu=disp-f03")).json()) as any;
    expect(resum.nombreVendes).toBe(1);
    expect(resum.efectiuCents).toBe(1700);
    expect(resum.targetaCents).toBe(0);
    expect(resum.vendes[0].linies.map((l: any) => l.preuCents)).toEqual([1200, 300, 200]);
  });

  it("F-03 treure el producte treu també els seus charms", async () => {
    const { per } = await cataleg();
    let linies = afegeixProducte([], per("polsera-eslabons"));
    linies = afegeixCharm(linies, 0, per("charm-basic"));
    linies = afegeixProducte(linies, per("arracades-boles"));
    linies = treuLinia(linies, 0);
    expect(linies).toHaveLength(1);
    expect(linies[0].producteId).toBe("arracades-boles");
  });

  it("F-04 collaret de cordill + línia lliure de 8 € amb targeta: una venda de 13,00 € a Targeta", async () => {
    const { per } = await cataleg();
    let linies = afegeixProducte([], per("collaret-cordill"));
    linies = afegeixLliure(linies, "Peça personalitzada", eurosACents("8")!);
    expect(totalLinies(linies)).toBe(1300);

    const caixa = novaCaixa("disp-f04");
    const venda = novaVenda(caixa, "targeta", linies);
    await sincronitza({ dispositiuId: "disp-f04", caixes: [caixa], vendes: [venda] });
    const resum = (await (await crida("/api/resum?dispositiu=disp-f04")).json()) as any;
    expect(resum.nombreVendes).toBe(1);
    expect(resum.targetaCents).toBe(1300);
    expect(resum.efectiuCents).toBe(0);
    expect(resum.vendes[0].linies).toHaveLength(2);
  });

  it("F-05 polseres amistat: una línia de 10,00 € (parell); no hi ha unitat", async () => {
    const { cataleg: tots, per } = await cataleg();
    const amistat = tots.filter((p) => /amistat/i.test(p.nom));
    expect(amistat).toHaveLength(1);
    expect(amistat[0].unitat).toBe("parell");
    const linies = afegeixProducte([], per("polseres-amistat"));
    expect(linies).toEqual([
      expect.objectContaining({ preuCents: 1000, quantitat: 1, descripcio: "Polseres amistat (parell)" }),
    ]);
  });

  it("F-08 imports amb cèntims: 3 × 0,10 € fa 0,30 € exacte i es desa en cèntims enters", async () => {
    expect(eurosACents("0,10")).toBe(10);
    expect(eurosACents("0.10")).toBe(10);
    expect(eurosACents("12,5")).toBe(1250);
    expect(eurosACents("1,005")).toBeNull();
    expect(eurosACents("-1")).toBeNull();
    let linies = afegeixLliure([], "Charm solt", 10);
    linies = afegeixLliure(linies, "Charm solt", 10);
    linies = afegeixLliure(linies, "Charm solt", 10);
    expect(totalLinies(linies)).toBe(30);
    expect(formatEuros(30)).toBe("0,30 €");

    const caixa = novaCaixa("disp-f08");
    const venda = novaVenda(caixa, "efectiu", linies);
    await sincronitza({ dispositiuId: "disp-f08", caixes: [caixa], vendes: [venda] });
    const resum = (await (await crida("/api/resum?dispositiu=disp-f08")).json()) as any;
    expect(resum.efectiuCents).toBe(30);
    expect(Number.isInteger(resum.vendes[0].totalCents)).toBe(true);
  });

  it("F-08 el servidor rebutja imports amb decimals o un total que no quadra", async () => {
    const caixa = novaCaixa("disp-f08b");
    const decimal = novaVenda(caixa, "efectiu", [lliure(10.5)]);
    const descuadrat = novaVenda(caixa, "efectiu", [lliure(500)], { totalCents: 400 });
    const { cos } = await sincronitza({ dispositiuId: "disp-f08b", caixes: [caixa], vendes: [decimal, descuadrat] });
    expect(cos.rebutjades.map((r: any) => r.id).sort()).toEqual([decimal.id, descuadrat.id].sort());
    const resum = (await (await crida("/api/resum?dispositiu=disp-f08b")).json()) as any;
    expect(resum.nombreVendes).toBe(0);
  });

  it("F-06 anul·lar una venda de 17 € amb motiu «duplicada»: el net baixa 17 € i queda visible", async () => {
    const caixa = novaCaixa("disp-f06");
    const v1 = novaVenda(caixa, "efectiu", [lliure(1700)]);
    const v2 = novaVenda(caixa, "efectiu", [lliure(1700)]);
    await sincronitza({ dispositiuId: "disp-f06", caixes: [caixa], vendes: [v1, v2] });
    let resum = (await (await crida("/api/resum?dispositiu=disp-f06")).json()) as any;
    expect(resum.netCents).toBe(3400);

    const anulacio = {
      id: crypto.randomUUID(),
      vendaId: v2.id,
      motiu: "duplicada",
      usuaria: "elena@example.test",
      creadaA: "2026-12-05T10:05:00.000Z",
    };
    const { cos } = await sincronitza({ dispositiuId: "disp-f06", anulacions: [anulacio] }, "elena@example.test");
    expect(cos.rebutjades).toEqual([]);
    resum = (await (await crida("/api/resum?dispositiu=disp-f06")).json()) as any;
    expect(resum.netCents).toBe(1700);
    expect(resum.efectiuCents).toBe(1700);
    expect(resum.nombreAnulades).toBe(1);
    const anulada = resum.vendes.find((v: any) => v.id === v2.id);
    expect(anulada.anulacio).toMatchObject({ motiu: "duplicada", usuaria: "elena@example.test", creadaA: "2026-12-05T10:05:00.000Z" });

    // Mateix càlcul al dispositiu (sense connexió).
    const local = resumVendes([v1, v2], [anulacio]);
    expect(local.netCents).toBe(1700);
    expect(local.nombreAnulades).toBe(1);
  });

  it("F-06 una anul·lació sense motiu es rebutja", async () => {
    const caixa = novaCaixa("disp-f06b");
    const v = novaVenda(caixa, "efectiu", [lliure(1700)]);
    const sense = { id: crypto.randomUUID(), vendaId: v.id, motiu: "  ", usuaria: "laura@example.test", creadaA: "2026-12-05T10:05:00.000Z" };
    const { cos } = await sincronitza({ dispositiuId: "disp-f06b", caixes: [caixa], vendes: [v], anulacions: [sense] });
    expect(cos.rebutjades.map((r: any) => r.id)).toEqual([sense.id]);
  });
});
