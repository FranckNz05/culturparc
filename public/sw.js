/**
 * Service worker de Culture Parc.
 *
 * Objectif volontairement limite : rendre l'application installable et
 * utilisable quand le reseau flanche, sans jamais servir une information
 * fausse. La disponibilite des places et l'etat des paiements changent a la
 * seconde : ces reponses ne sont donc jamais mises en cache.
 */

const VERSION = "cp-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = "/hors-ligne";

const SHELL_ASSETS = [OFFLINE_URL, "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Rien de ce qui touche a l'argent, aux places ou au scan ne doit etre cache. */
function isAlwaysFresh(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/commande") ||
    url.pathname.startsWith("/seances") ||
    url.pathname.startsWith("/scan") ||
    url.pathname.startsWith("/admin")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Les ecritures ne passent jamais par le cache.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Requetes vers d'autres domaines : laissees au navigateur.
  if (url.origin !== self.location.origin) return;

  if (isAlwaysFresh(url)) return;

  // Navigation : le reseau d'abord, la page hors ligne en dernier recours.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        return cached ?? caches.match(OFFLINE_URL);
      }),
    );
    return;
  }

  // Fichiers statiques : servis depuis le cache, rafraichis en arriere-plan.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|avif)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);

        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);

        return cached ?? network;
      }),
    );
  }
});
