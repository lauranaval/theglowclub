// Service worker: guarda l'app a la memòria cau perquè s'obri sense connexió.
// L'API (/api/*) i l'entrada (/entrar, /dev/*) sempre van a la xarxa.
/// <reference lib="webworker" />
declare const __VERSIO__: string;
declare const __FITXERS__: string[];

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `glow-${__VERSIO__}`;

sw.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(__FITXERS__))
      .then(() => sw.skipWaiting()),
  );
});

sw.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claus) => Promise.all(claus.filter((k) => k.startsWith("glow-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== sw.location.origin) return;
  const p = url.pathname;
  if (p.startsWith("/api/") || p.startsWith("/dev/") || p === "/entrar" || p.startsWith("/cdn-cgi/") || p === "/sw.js") return;

  if (req.mode === "navigate") {
    e.respondWith(caches.match("/", { cacheName: CACHE }).then((r) => r ?? fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { cacheName: CACHE }).then((r) => r ?? fetch(req)));
});
