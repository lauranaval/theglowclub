// Identitat de la usuària.
// A producció: JWT de Cloudflare Access (capçalera Cf-Access-Jwt-Assertion o cookie CF_Authorization),
// verificat amb les claus públiques de l'equip. Res no es creu sense signatura vàlida.
// En desenvolupament (DEV_AUTH=1, només a `wrangler dev`): cookie glow_dev_user.

export interface EnvAcces {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  USUARIES?: string;
  DEV_AUTH?: string;
}

interface JwkAmbKid extends JsonWebKey {
  kid?: string;
}

const MEMORIA_CLAUS = new Map<string, { claus: JwkAmbKid[]; caduca: number }>();

export function modeDesenvolupament(env: EnvAcces): boolean {
  return env.DEV_AUTH === "1";
}

export function llegeixCookie(req: Request, nom: string): string | null {
  const cap = req.headers.get("cookie") ?? "";
  for (const part of cap.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === nom) return decodeURIComponent(v.join("="));
  }
  return null;
}

export async function identitat(req: Request, env: EnvAcces): Promise<string | null> {
  let email: string | null = null;
  if (modeDesenvolupament(env)) {
    email = llegeixCookie(req, "glow_dev_user");
  } else {
    const jwt = req.headers.get("Cf-Access-Jwt-Assertion") ?? llegeixCookie(req, "CF_Authorization");
    if (jwt) email = await verificaJwt(jwt, env).catch(() => null);
  }
  if (!email) return null;
  email = email.trim().toLowerCase();
  const permeses = (env.USUARIES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (permeses.length > 0 && !permeses.includes(email)) return null;
  return email;
}

function decodifica(part: string): any {
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  return JSON.parse(new TextDecoder().decode(bytes(b64)));
}

function bytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function clausEquip(domini: string, forcar = false): Promise<JwkAmbKid[]> {
  const desada = MEMORIA_CLAUS.get(domini);
  if (!forcar && desada && desada.caduca > Date.now()) return desada.claus;
  const r = await fetch(`https://${domini}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error("No s'han pogut obtenir les claus d'Access");
  const { keys } = (await r.json()) as { keys: JwkAmbKid[] };
  MEMORIA_CLAUS.set(domini, { claus: keys, caduca: Date.now() + 60 * 60 * 1000 });
  return keys;
}

async function verificaJwt(jwt: string, env: EnvAcces): Promise<string | null> {
  const domini = env.ACCESS_TEAM_DOMAIN?.trim();
  const aud = env.ACCESS_AUD?.trim();
  if (!domini || !aud) return null;
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  const cap = decodifica(parts[0]);
  const cos = decodifica(parts[1]);
  if (cap.alg !== "RS256" || typeof cap.kid !== "string") return null;

  let claus = await clausEquip(domini);
  let jwk = claus.find((k) => k.kid === cap.kid);
  if (!jwk) {
    claus = await clausEquip(domini, true); // rotació de claus
    jwk = claus.find((k) => k.kid === cap.kid);
  }
  if (!jwk) return null;

  const clau = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signatura = bytes(parts[2].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parts[2].length / 4) * 4, "="));
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    clau,
    signatura,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) return null;

  const ara = Math.floor(Date.now() / 1000);
  const auds: unknown[] = Array.isArray(cos.aud) ? cos.aud : [cos.aud];
  if (cos.iss !== `https://${domini}`) return null;
  if (!auds.includes(aud)) return null;
  if (typeof cos.exp !== "number" || cos.exp <= ara) return null;
  if (typeof cos.nbf === "number" && cos.nbf > ara + 60) return null;
  return typeof cos.email === "string" ? cos.email : null;
}
