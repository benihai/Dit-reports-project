const CACHE = 'dit-report-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/router.js',
  './js/storage.js',
  './js/logoSearch.js',
  './js/pdfMarkup.js',
  './js/pdfExport.js',
  './js/views/people.js',
  './js/views/projects.js',
  './js/views/newProject.js',
  './js/views/reports.js',
  './js/views/noteModal.js',
  './js/views/report.js',
  './js/app.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
