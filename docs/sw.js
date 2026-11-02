/* Service Worker — BFR Chantier (100 % hors connexion) */
const CACHE = 'bfr-chantier-3b3c80da94';
const FICHIERS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];
const DELAI_RESEAU = 3500;
const delai = (ms) => new Promise((ok) => setTimeout(ok, ms));

function servir(requete, estPage) {
  const opts = (estPage || requete.url.includes('manifest')) ? { cache: 'no-cache' } : {};
  const reseau = fetch(requete, opts).then((rep) => {
    if (rep && rep.ok) {
      const copie = rep.clone();
      caches.open(CACHE).then((c) => c.put(requete, copie)).catch(() => {});
    }
    return rep && rep.ok ? rep : null;
  }).catch(() => null);

  return Promise.race([reseau, delai(DELAI_RESEAU)]).then((vite) =>
    vite || caches.match(requete)
      .then((c) => c || (estPage ? caches.match('./') : null))
      .then((c) => c || reseau)
      .then((c) => c || new Response('Hors connexion', { status: 503 }))
  );
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

const ORIGINES_POLICES = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
function servirPolice(requete) {
  return caches.open(CACHE).then((c) => c.match(requete).then((enCache) => {
    const reseau = fetch(requete).then((rep) => {
      if (rep && (rep.ok || rep.type === 'opaque')) c.put(requete, rep.clone()).catch(() => {});
      return rep;
    }).catch(() => null);
    return enCache || reseau.then((rep) => rep || new Response('', { status: 504 }));
  }));
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const origine = new URL(e.request.url).origin;
  if (ORIGINES_POLICES.indexOf(origine) !== -1) { e.respondWith(servirPolice(e.request)); return; }
  if (origine !== self.location.origin) return;
  e.respondWith(servir(e.request, e.request.mode === 'navigate'));
});
