import { beforeEach, describe, expect, it } from "vitest";
import { crida, lliure, novaCaixa, novaVenda, simulaCertificatsAccess, sincronitza } from "./ajuda";
import { calculaTancament } from "../src/shared/venda";

describe("Caixa, sincronització i esdeveniment", () => {
  beforeEach(simulaCertificatsAccess);

  it("F-07 canvi 50 €, efectiu 120 €, recompte 165 €; targeta 86 €, TPV 86 €: esperat 170 €, diferència −5 €, targeta 0 €", async () => {
    const caixa = novaCaixa("disp-f07", 5000);
    const vendes = [
      novaVenda(caixa, "efectiu", [lliure(7000)]),
      novaVenda(caixa, "efectiu", [lliure(5000)]),
      novaVenda(caixa, "targeta", [lliure(8600)]),
    ];
    const calcul = calculaTancament({
      canviInicialCents: 5000,
      vendes,
      anulacions: [],
      recompteEfectiuCents: 16500,
      tpvTargetaCents: 8600,
    });
    expect(calcul).toEqual({
      efectiuEsperatCents: 17000,
      diferenciaEfectiuCents: -500,
      targetaEsperadaCents: 8600,
      diferenciaTargetaCents: 0,
    });

    const tancada = {
      ...caixa,
      tancadaA: "2026-12-05T20:00:00.000Z",
      recompteEfectiuCents: 16500,
      tpvTargetaCents: 8600,
      nota: "Falten 5 €; possible canvi mal donat",
      usuariaTancament: "laura@example.test",
    };
    await sincronitza({ dispositiuId: "disp-f07", caixes: [caixa], vendes });
    const { cos } = await sincronitza({ dispositiuId: "disp-f07", caixes: [tancada] });
    expect(cos.rebutjades).toEqual([]);
    const resum = (await (await crida("/api/resum?dispositiu=disp-f07")).json()) as any;
    expect(resum.caixes[0]).toMatchObject({
      canviInicialCents: 5000,
      recompteEfectiuCents: 16500,
      tpvTargetaCents: 8600,
      nota: "Falten 5 €; possible canvi mal donat",
      efectiuEsperatCents: 17000,
      diferenciaEfectiuCents: -500,
      diferenciaTargetaCents: 0,
    });
  });

  it("F-10 30 vendes amb tall després de 12 i reenviament: exactament 30 al servidor, sense duplicats", async () => {
    const caixa = novaCaixa("disp-f10");
    const vendes = Array.from({ length: 30 }, (_, i) => novaVenda(caixa, i % 2 ? "targeta" : "efectiu", [lliure(500)]));
    // Primer enviament: arriben 12 i la connexió es talla abans que el dispositiu rebi la resposta.
    await sincronitza({ dispositiuId: "disp-f10", caixes: [caixa], vendes: vendes.slice(0, 12) });
    // Torna la connexió: el dispositiu no sap què ha arribat i ho reenvia tot.
    const { cos } = await sincronitza({ dispositiuId: "disp-f10", caixes: [caixa], vendes });
    expect(cos.acceptades.vendes).toHaveLength(30);
    // Un tercer reenviament tampoc no duplica.
    await sincronitza({ dispositiuId: "disp-f10", caixes: [caixa], vendes: vendes.slice(5, 20) });
    const resum = (await (await crida("/api/resum?dispositiu=disp-f10")).json()) as any;
    expect(resum.nombreVendes).toBe(30);
    expect(resum.netCents).toBe(30 * 500);
    expect(resum.nombreCaixes).toBe(1);
  });

  it("F-11 un tancament arribat després no es pot sobreescriure amb un altre", async () => {
    const caixa = novaCaixa("disp-f11", 2000);
    const primer = { ...caixa, tancadaA: "2026-12-05T20:00:00.000Z", recompteEfectiuCents: 2000, tpvTargetaCents: 0, usuariaTancament: "laura@example.test" };
    const segon = { ...primer, recompteEfectiuCents: 9999 };
    await sincronitza({ dispositiuId: "disp-f11", caixes: [caixa] });
    await sincronitza({ dispositiuId: "disp-f11", caixes: [primer] });
    await sincronitza({ dispositiuId: "disp-f11", caixes: [segon] });
    const resum = (await (await crida("/api/resum?dispositiu=disp-f11")).json()) as any;
    expect(resum.caixes[0].recompteEfectiuCents).toBe(2000);
  });

  it("F-12 dos dispositius (A: 3 vendes, 40 €; B: 2 vendes, 25 €): l'esdeveniment suma 5 vendes, 65 € i dues caixes", async () => {
    const esd = "fira-nadal-llavaneres-2026";
    const a = novaCaixa("disp-f12-a", 0, { dia: "2026-12-06" });
    const b = novaCaixa("disp-f12-b", 0, { dia: "2026-12-06", usuariaObertura: "sandra@example.test" });
    const vendesA = [1500, 1500, 1000].map((c) => novaVenda(a, "efectiu", [lliure(c)]));
    const vendesB = [1200, 1300].map((c) => novaVenda(b, "targeta", [lliure(c)], { usuaria: "sandra@example.test" }));
    await sincronitza({ dispositiuId: a.dispositiuId, caixes: [a], vendes: vendesA });
    await sincronitza({ dispositiuId: b.dispositiuId, caixes: [b], vendes: vendesB }, "sandra@example.test");
    const resum = (await (await crida(`/api/resum?esdeveniment=${esd}&dia=2026-12-06`)).json()) as any;
    expect(resum.nombreVendes).toBe(5);
    expect(resum.netCents).toBe(6500);
    expect(resum.nombreCaixes).toBe(2);
  });

  it("F-13 Llavaneres amb 4 tallers externs sense recompte: «Ocupació desconeguda» i cap import a caixa ni pendents", async () => {
    const r = await crida("/api/esdeveniments/fira-nadal-llavaneres-2026");
    expect(r.status).toBe(200);
    const fitxa = (await r.json()) as any;
    expect(fitxa.tallers).toHaveLength(4);
    expect(fitxa.tallers.filter((t: any) => t.public === "infantil" && t.preuCents === 1000)).toHaveLength(2);
    expect(fitxa.tallers.filter((t: any) => t.public === "adult" && t.preuCents === 1500)).toHaveLength(2);
    for (const t of fitxa.tallers) {
      expect(t.modalitat).toBe("extern");
      expect(t.ocupacio).toBe("Ocupació desconeguda");
    }
    expect(fitxa.pendentsCents).toBe(0);
    // La caixa només conté vendes de paradeta: res de les inscripcions (10 € / 15 €) dels tallers externs.
    const vendes = (await (await crida("/api/resum?esdeveniment=fira-nadal-llavaneres-2026")).json()) as any;
    const sumaParadeta = vendes.vendes.filter((v: any) => !v.anulacio).reduce((s: number, v: any) => s + v.totalCents, 0);
    expect(fitxa.caixa.netCents).toBe(sumaParadeta);
    expect(fitxa.caixa.netCents).toBe(fitxa.caixa.efectiuCents + fitxa.caixa.targetaCents);
  });
});
