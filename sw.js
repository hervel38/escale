/* Escale — service worker.
   Stratégie : cache-first sur une liste fermée de fichiers.
   Tout le contenu pédagogique étant embarqué dans index.html, mettre la
   coquille en cache suffit à rendre l'application intégralement hors-ligne.

   → Incrémenter CACHE à chaque modification d'un fichier, sinon l'ancienne
     version restera servie depuis le cache.                               */

const CACHE = "escale-v3";

const FICHIERS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FICHIERS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request)
        .then(rep => {
          // On ne met en cache que nos propres ressources, en réponse valide.
          if (rep.ok && new URL(e.request.url).origin === location.origin) {
            const copie = rep.clone();
            caches.open(CACHE).then(c => c.put(e.request, copie));
          }
          return rep;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
