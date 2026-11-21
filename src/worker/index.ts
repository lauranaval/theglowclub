// Worker de The Glow Club: API protegida per Cloudflare Access. Els fitxers de l'app (PWA) els serveix `assets`.
import { identitat, modeDesenvolupament, type EnvAcces } from "./acces";
import { cataleg, esdeveniments, fitxaEsdeveniment, resum, sincronitza } from "./dades";

export interface Env extends EnvAcces {
  DB: D1Database;
  ASSETS?: Fetcher;
}

const NO_CACHE = { "cache-control": "no-store" };

function json(dades: unknown, status = 200): Response {
  return Response.json(dades, { status, headers: NO_CACHE });
}

function prohibit(): Response {
  return json({ error: "sessio", missatge: "Cal entrar amb el compte de The Glow Club." }, 403);
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const ruta = url.pathname;

    if (ruta.startsWith("/dev/")) return desenvolupament(req, env, url);

    if (ruta === "/entrar") {
      if (modeDesenvolupament(env)) return paginaEntradaDev(url.searchParams.get("error"));
      // A producció, Cloudflare Access ja ha demanat el codi abans d'arribar aquí.
      const email = await identitat(req, env);
      return email ? Response.redirect(new URL("/", url).href, 302) : new Response("Cal entrar amb Cloudflare Access.", { status: 403 });
    }

    if (!ruta.startsWith("/api/")) {
      return env.ASSETS ? env.ASSETS.fetch(req) : new Response("No trobat", { status: 404 });
    }

    const email = await identitat(req, env);
    if (!email) return prohibit();

    try {
      if (ruta === "/api/jo" && req.method === "GET") return json({ email });

      if (ruta === "/api/dades" && req.method === "GET") {
        const [prod, esd] = await Promise.all([cataleg(env.DB), esdeveniments(env.DB)]);
        return json({ usuaria: email, cataleg: prod, ...esd, generatA: new Date().toISOString() });
      }

      if (ruta === "/api/sync" && req.method === "POST") {
        let cos: any;
        try {
          cos = await req.json();
        } catch {
          return json({ error: "JSON no vàlid" }, 400);
        }
        const permeses = (env.USUARIES ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
        return json(await sincronitza(env.DB, email, cos ?? {}, permeses));
      }

      if (ruta === "/api/resum" && req.method === "GET") {
        const dia = url.searchParams.get("dia");
        if (dia && !DIA.test(dia)) return json({ error: "dia no vàlid" }, 400);
        return json(
          await resum(env.DB, {
            dia,
            esdeveniment: url.searchParams.get("esdeveniment"),
            dispositiu: url.searchParams.get("dispositiu"),
          }),
        );
      }

      const esd = /^\/api\/esdeveniments\/([A-Za-z0-9_-]+)$/.exec(ruta);
      if (esd && req.method === "GET") {
        const fitxa = await fitxaEsdeveniment(env.DB, esd[1]);
        return fitxa ? json(fitxa) : json({ error: "no trobat" }, 404);
      }

      return json({ error: "no trobat" }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: "error intern" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

// --- Només en desenvolupament local (DEV_AUTH=1). A producció aquestes rutes no existeixen. ---

function desenvolupament(req: Request, env: Env, url: URL): Response {
  if (!modeDesenvolupament(env)) return new Response("No trobat", { status: 404 });
  if (url.pathname === "/dev/entrar") {
    const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) return Response.redirect(new URL("/entrar?error=1", url).href, 302);
    return new Response(null, {
      status: 302,
      headers: {
        location: "/",
        "set-cookie": `glow_dev_user=${encodeURIComponent(email)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`,
      },
    });
  }
  if (url.pathname === "/dev/sortir") {
    return new Response(null, {
      status: 302,
      headers: { location: "/entrar", "set-cookie": "glow_dev_user=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" },
    });
  }
  return new Response("No trobat", { status: 404 });
}

function paginaEntradaDev(error: string | null): Response {
  const html = `<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Entrar · The Glow Club (prova local)</title>
<style>body{font-family:system-ui,sans-serif;background:#FAF6F7;color:#3A1830;display:grid;place-items:center;min-height:100vh;margin:0}
form{background:#fff;padding:24px;border-radius:12px;max-width:340px;width:90%;box-shadow:0 2px 12px #3a183022}
input,button{font-size:16px;width:100%;box-sizing:border-box;min-height:44px;margin-top:8px;border-radius:8px}
input{border:1px solid #c9b3c0;padding:8px}button{background:#DE2F40;color:#fff;border:0;font-weight:600}</style></head>
<body><form method="get" action="/dev/entrar"><h1>The Glow Club</h1>
<p>Entrada de <strong>prova local</strong>. A l'app real s'entra amb el codi que arriba al correu (Cloudflare Access).</p>
${error ? '<p role="alert">Escriu un correu vàlid.</p>' : ""}
<label>Correu<input name="email" type="email" autocomplete="email" required value="laura@example.test"></label>
<button type="submit">Entrar</button></form></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", ...NO_CACHE } });
}
