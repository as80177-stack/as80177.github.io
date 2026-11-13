const CACHE_NAME = 'homily-notes-v54';
const APP_SHELL = [
  './',
  './index.html',
  './homily.html',
  './offline.js',
  './backup.js',
  './data-model.js',
  './verses.js',
  './cover.js',
  './christmas-organ.js',
  './cover.css',
  './install.html',
  './install.js',
  './reader.js',
  './voice-search.js',
  './search-matching.js',
  './voice-search-commands.js',
  './translations.js',
  './narration.js',
  './reader.css',
  './data/verses.json',
  './manifest.webmanifest',
  './icons/app-icon.svg',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png',
  './data/year-a.json',
  './data/year-b.json',
  './data/apostles.json',
  './data/marian.json',
  './data/theology.json',
  './data/year-c.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL.map(path => new Request(path, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('homily-notes-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/admin/')) return;

  event.respondWith(
    fetch(new Request(request, { cache: 'no-store' }))
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
  );
});
