
const CACHE_NAME = 'inspectzen-cache-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  // '/favicon.ico', // Favicon is usually implicitly cached by browser or handled by manifest
  // Critical JS/CSS bundles are hard to list statically for Next.js due to hashing.
  // This basic caching mainly focuses on the app shell for PWA installability.
];

// Install a service worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installation complete, skipping waiting.');
        return self.skipWaiting(); // Ensures the new service worker activates immediately
      })
      .catch((error) => {
        console.error('Service Worker: Cache addAll failed during install - ', error);
      })
  );
});

// Activate the service worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Claiming clients.');
      return self.clients.claim(); // Allows the activated service worker to take control of the page immediately
    })
  );
});

// Listen for network requests
self.addEventListener('fetch', (event) => {
  // We'll use a network-first strategy for most requests.
  // For specific assets (like those in urlsToCache), a cache-first might be suitable,
  // but for dynamic apps, network-first or stale-while-revalidate is often safer.

  if (event.request.method !== 'GET') {
    // Don't cache non-GET requests
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Check if we received a valid response
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network request failed, try to get it from the cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If not in cache and network failed, provide a generic offline fallback for navigation requests
            if (event.request.mode === 'navigate') {
              // You could return an offline.html page here if you had one cached
              // return caches.match('/offline.html');
            }
            // For other requests, just let the browser handle the error (e.g. for images, API calls)
            // Simulating a network error response
            return new Response('Network error: The resource is not available offline and the network request failed.', {
              status: 408, // Request Timeout
              statusText: 'Network error: The resource is not available offline and the network request failed.',
              headers: { 'Content-Type': 'text/plain' },
            });
          });
      })
  );
});
