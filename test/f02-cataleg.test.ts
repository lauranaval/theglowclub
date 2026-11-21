import { beforeEach, describe, expect, it } from "vitest";
import { crida, simulaCertificatsAccess } from "./ajuda";

// Taula de docs/CATALEG_FIRA.md (21/11/2026): nom, preu en cèntims, charms inclosos.
const ESPERAT: Array<[string, number, number]> = [
  ["Polsera d'eslabons + 3 charms", 1200, 3],
  ["Collaret d'eslabons + 3 charms", 1500, 3],
  ["Collaret de cordill + 1 charm", 500, 1],
  ["Polsera de vellut + 2 charms", 600, 2],
  ["Polseres amistat (parell)", 1000, 2],
  ["Collarets de cadeneta fina + charm BFF + 1 charm (parell)", 1600, 4],
  ["Collaret de cadeneta fina + charm BFF + 1 charm (unitat)", 900, 2],
  ["Arracades floreta", 500, 0],
  ["Arracades boles", 600, 0],
  ["Arracades d'aro finet + charm (parell)", 800, 2],
  ["Charm extra bàsic", 200, 0],
  ["Charm extra especial", 300, 0],
];

describe("F-02 catàleg inicial", () => {
  beforeEach(simulaCertificatsAccess);

  it("F-02 carrega 12 productes amb els preus i charms de CATALEG_FIRA.md", async () => {
    const r = await crida("/api/dades");
    expect(r.status).toBe(200);
    const { cataleg } = (await r.json()) as { cataleg: any[] };
    expect(cataleg).toHaveLength(12);
    expect(cataleg.map((p) => [p.nom, p.preuCents, p.charmsInclosos])).toEqual(ESPERAT);
    expect(cataleg.every((p) => Number.isInteger(p.preuCents))).toBe(true);
    const basic = cataleg.find((p) => p.tipusCharm === "basic");
    const especial = cataleg.find((p) => p.tipusCharm === "especial");
    expect(basic?.preuCents).toBe(200);
    expect(especial?.preuCents).toBe(300);
  });
});
