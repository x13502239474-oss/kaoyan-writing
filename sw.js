/* Service Worker：在线优先 + 离线回退缓存，保证代码更新即时生效且断网可用 */
'use strict';
const CACHE = 'ky-writing-shell-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/tokens.css', './css/app.css', './css/views.css',
  './js/app.js', './js/store.js', './js/seed.js', './js/utils.js', './js/ui.js',
  './js/views/home.js', './js/views/courses.js', './js/views/materials.js',
  './js/views/models.js', './js/views/drills.js', './js/views/exam.js',
  './js/views/archive.js', './js/views/review.js', './js/views/settings.js', './js/views/me.js',
  './icons/favicon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req).then(hit => {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('./index.html');
      return new Response('', { status: 503, statusText: 'Offline' });
    }))
  );
});
