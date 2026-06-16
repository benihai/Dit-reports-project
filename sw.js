const CACHE = 'dit-v59';

const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/vendor/supabase.js',
  './js/vendor/localforage.js',
  './js/vendor/qrcode.js',
  './js/config.js',
  './js/supabase-client.js',
  './js/auth.js',
  './js/router.js',
  './js/storage.js',
  './js/netStatus.js',
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
  './js/emailShare.js',
  './js/app.js',
  './icons/dit-logo.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.json',
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

  // Only handle http(s). Extension-injected resources use schemes like
  // chrome-extension:// which the Cache API can't store — cache.put() throws
  // "Request scheme 'chrome-extension' is unsupported". Let them pass through.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Don't intercept Supabase API calls — let them reach the network directly
  if (url.hostname.includes('supabase.co')) return;

  // Network-first for the app shell (the HTML document). Always try the network
  // so a new deployment is picked up the moment the device is online, instead of
  // a cached shell masking it. This is the key fix for iOS: there the SW serving
  // cache-first could keep showing an old version indefinitely (iOS throttles SW
  // updates, and deleting the home-screen icon does NOT clear the SW or caches —
  // they live at the origin level). Falls back to the cached shell when offline.
  const isShell = e.request.mode === 'navigate' ||
                  url.pathname.endsWith('/') ||
                  url.pathname.endsWith('/index.html');
  if (isShell) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request)
            .then(r => r || caches.match('./index.html'))
            .then(r => r || new Response('Offline', { status: 503, statusText: 'Offline' }))
        )
    );
    return;
  }

  // Everything else (version-stamped JS/CSS, images, fonts): stale-while-
  // revalidate — serve cache immediately, refresh in the background. Safe because
  // these URLs carry ?v=, so a new build requests new URLs not yet in the cache.
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
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

// Background Sync: fires when connectivity returns, even if the tab was
// backgrounded. We don't replay requests in the SW itself (the write logic +
// Supabase client live in the page); instead we wake any open client so its
// Storage queue flushes. If no client is open the queue still flushes on the
// next app load, so no data is lost.
self.addEventListener('sync', e => {
  if (e.tag !== 'dc-sync') return;
  e.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
      .then(clients => clients.forEach(c => c.postMessage({ type: 'dc:flush' })))
  );
});
