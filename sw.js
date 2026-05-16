const CACHE = 'dit-v16';

const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/vendor/supabase.js',
  './js/config.js',
  './js/supabase-client.js',
  './js/auth.js',
  './js/router.js',
  './js/storage.js',
  './js/logoSearch.js',
  './js/pdfMarkup.js',
  './js/pdfExport.js',
  './js/views/login.js',
  './js/views/viewerReports.js',
  './js/views/admin.js',
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
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Don't intercept Supabase API calls — let them reach the network directly
  if (url.hostname.includes('supabase.co')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      // Stale-while-revalidate: serve cache immediately, update in background.
      // If fetch fails, fall back to cached index.html (app shell).
      const network = fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match('./index.html')
            .then(r => r || new Response('Offline', { status: 503, statusText: 'Offline' }))
        );

      return cached || network;
    })
  );
});
