import { beforeEach, describe, expect, it } from "vitest";
import { crida, jwtAccess, simulaCertificatsAccess } from "./ajuda";

describe("F-01 accés només amb identitat de Cloudflare Access", () => {
  beforeEach(simulaCertificatsAccess);

  it("F-01 petició sense identitat: 403 i cap dada", async () => {
    for (const ruta of ["/api/dades", "/api/resum?dia=2026-12-05", "/api/jo"]) {
      const r = await crida(ruta, {}, null);
      expect(r.status).toBe(403);
      const text = await r.text();
      expect(text).not.toMatch(/Polsera|Llavaneres|preu/i);
    }
    const sync = await crida("/api/sync", { method: "POST", body: "{}" }, null);
    expect(sync.status).toBe(403);
  });

  it("F-01 JWT amb signatura falsa, caducat o d'una altra aplicació: 403", async () => {
    const bo = await jwtAccess("laura@example.test");
    const fals = bo.slice(0, -6) + "AAAAAA";
    const caducat = await jwtAccess("laura@example.test", { exp: Math.floor(Date.now() / 1000) - 60 });
    const altraAud = await jwtAccess("laura@example.test", { aud: ["una-altra-app"] });
    for (const jwt of [fals, caducat, altraAud, "no-es-un-jwt"]) {
      const r = await crida("/api/jo", { headers: { "Cf-Access-Jwt-Assertion": jwt } }, null);
      expect(r.status).toBe(403);
    }
  });

  it("F-01 la cookie de desenvolupament no serveix fora del mode de desenvolupament", async () => {
    const r = await crida("/api/jo", { headers: { cookie: "glow_dev_user=laura@example.test" } }, null);
    expect(r.status).toBe(403);
    const entrada = await crida("/dev/entrar?email=laura@example.test", {}, null);
    expect(entrada.status).toBe(404);
  });

  it("F-01 amb identitat vàlida respon i diu qui és", async () => {
    const r = await crida("/api/jo");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ email: "laura@example.test" });
  });
});
