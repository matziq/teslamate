const CACHE = "teslamate-mobile-shell-v1";
const SHELL = ["/mobile/", "/mobile/styles.css", "/mobile/app.js", "/mobile/manifest.webmanifest", "/mobile/icon.svg", "/mobile/icon-192.png", "/mobile/icon-512.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("teslamate-mobile-shell-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith("/mobile/") || url.pathname.startsWith("/mobile/api/")) return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match(event.request)) ?? (event.request.mode === "navigate" ? caches.match("/mobile/") : Response.error())));
});
