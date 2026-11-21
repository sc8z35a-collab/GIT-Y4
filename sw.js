/* NARROW-50 3-Story + Attic Offline PWA Service Worker */
const CACHE_NAME = 'narrow50-tower-dev-C2jbr8_Vjs-dev-CYdGXHDdc';

// Replaced automatically by scripts/postbuild.mjs during npm run build
const BUILT_ASSETS = [
  './assets/dev-C2jbr8_V.js',
  './assets/dev-CYdGXHDd.css',
  './assets/three-vendor-BW48nmf8.js',
];

const CORE_PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  ...BUILT_ASSETS,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isHtmlOrManifest =
    req.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('.webmanifest');

  if (isHtmlOrManifest) {
    // Network-first for HTML & manifest so GitHub Pages updates appear immediately while remaining offline-capable
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for immutable hashed bundles (./assets/*), 121 PNG textures (./textures/*), and icons (./icons/*)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
