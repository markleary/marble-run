// Vite fills in the release hash and asset list after writing the production build.
const scope = self.registration.scope;
const cachePrefix = 'marble-run:' + scope + ':';
const cacheName = cachePrefix + '__BUILD_VERSION__';
const files = new Set(__ASSET_PATHS__.map(path => new URL(path, scope).href));
const shell = new URL('index.html', scope).href;

self.addEventListener('install', event => {
  // A failed download leaves the previous release in control. New releases wait
  // until all open game windows close before replacing their assets.
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll(Array.from(files, url => new Request(url, { cache: 'no-cache' })))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(cachePrefix) && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  let key = url.href;
  if (request.mode === 'navigate') {
    url.search = '';
    if (url.href === scope || url.href === shell) key = shell;
  }
  if (!files.has(key)) return;
  event.respondWith(caches.open(cacheName).then(async cache =>
    await cache.match(key) || fetch(request)
  ));
});
