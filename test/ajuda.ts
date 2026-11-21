// Ajudes comunes de les proves del Worker: identitat d'Access signada amb una clau de prova i dades de venda.
import { env } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { vi } from "vitest";
import worker from "../src/worker/index";
import type { Anulacio, Caixa, Linia, Metode, Venda } from "../src/shared/venda";
import { totalLinies } from "../src/shared/tiquet";

const KID = "clau-prova";
let parell: CryptoKeyPair | undefined;

async function claus(): Promise<CryptoKeyPair> {
  parell ??= (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  return parell;
}

function b64url(dades: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof dades === "string" ? new TextEncoder().encode(dades) : new Uint8Array(dades);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Signa un JWT com el que posa Cloudflare Access a la capçalera Cf-Access-Jwt-Assertion. */
export async function jwtAccess(email: string, canvis: Record<string, unknown> = {}): Promise<string> {
  const { privateKey } = await claus();
  const ara = Math.floor(Date.now() / 1000);
  const cap = b64url(JSON.stringify({ alg: "RS256", kid: KID, typ: "JWT" }));
  const cos = b64url(
    JSON.stringify({
      email,
      aud: [env.ACCESS_AUD],
      iss: `https://${env.ACCESS_TEAM_DOMAIN}`,
      iat: ara,
      exp: ara + 3600,
      ...canvis,
    }),
  );
  const signatura = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(`${cap}.${cos}`));
  return `${cap}.${cos}.${b64url(signatura)}`;
}

/** Fa que el Worker trobi la clau pública de prova quan demana els certificats d'Access. */
export async function simulaCertificatsAccess(): Promise<void> {
  const { publicKey } = await claus();
  const jwk = (await crypto.subtle.exportKey("jwk", publicKey)) as JsonWebKey;
  const original = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (entrada, init) => {
    const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    if (url === `https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`) {
      return Response.json({ keys: [{ ...jwk, kid: KID, alg: "RS256", use: "sig" }] });
    }
    return original(entrada as RequestInfo, init);
  });
}

/** Crida el Worker com una usuària autenticada per Access (o sense identitat si email és null). */
export async function crida(
  ruta: string,
  init: RequestInit = {},
  email: string | null = "laura@example.test",
): Promise<Response> {
  const capcaleres = new Headers(init.headers);
  if (email) capcaleres.set("Cf-Access-Jwt-Assertion", await jwtAccess(email));
  if (init.body && !capcaleres.has("content-type")) capcaleres.set("content-type", "application/json");
  const ctx = createExecutionContext();
  const resposta = await worker.fetch(new Request(`https://glow.example${ruta}`, { ...init, headers: capcaleres }), env, ctx);
  await waitOnExecutionContext(ctx);
  return resposta;
}

export async function sincronitza(
  cos: { dispositiuId: string; caixes?: Caixa[]; vendes?: Venda[]; anulacions?: Anulacio[] },
  email = "laura@example.test",
) {
  const r = await crida("/api/sync", { method: "POST", body: JSON.stringify({ caixes: [], vendes: [], anulacions: [], ...cos }) }, email);
  return { status: r.status, cos: (await r.json()) as any };
}

export function novaCaixa(dispositiuId: string, canvi = 5000, extra: Partial<Caixa> = {}): Caixa {
  return {
    id: crypto.randomUUID(),
    dispositiuId,
    esdevenimentId: "fira-nadal-llavaneres-2026",
    dia: "2026-12-05",
    obertaA: "2026-12-05T09:00:00.000Z",
    canviInicialCents: canvi,
    usuariaObertura: "laura@example.test",
    tancadaA: null,
    recompteEfectiuCents: null,
    tpvTargetaCents: null,
    nota: null,
    usuariaTancament: null,
    ...extra,
  };
}

export function novaVenda(caixa: Caixa, metode: Metode, linies: Linia[], extra: Partial<Venda> = {}): Venda {
  return {
    id: crypto.randomUUID(),
    caixaId: caixa.id,
    dispositiuId: caixa.dispositiuId,
    esdevenimentId: caixa.esdevenimentId,
    dia: caixa.dia,
    creadaA: "2026-12-05T10:00:00.000Z",
    metode,
    linies,
    totalCents: totalLinies(linies),
    usuaria: "laura@example.test",
    ...extra,
  };
}

export function lliure(preuCents: number, descripcio = "Peça personalitzada", quantitat = 1): Linia {
  return { tipus: "lliure", producteId: null, descripcio, preuCents, quantitat, pare: null };
}
