// ===================================================
// CloudAI Service Worker v2.0 — Cache-first strategy
// FIX: was empty before (PWA offline not working)
// ===================================================

const CACHE_NAME  = "cloudai-v2";
const CACHE_FIRST = [
  "/",
  "/index.html",
  "/live.html",
  "/assets/css/style.css",
  "/assets/css/live.css",
  "/assets/js/chat.js",
  "/assets/js/live.js",
  "/assets/js/typing.js",
  "/logo.png",
  "/favicon.png",
  "/Pin.png",
  "/Send.png",
  "/Mic.png",
  "/Stop.png",
];

// Install: cache core assets
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("📦 CloudAI SW: caching assets");
      return cache.addAll(CACHE_FIRST).catch(err => {
        console.warn("SW cache partial fail:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log("🗑️ CloudAI SW: deleting old cache", k);
          return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for assets, network-first for API
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Always go to network for API calls
  if (url.hostname.includes("workers.dev") ||
      url.hostname.includes("googleapis.com") ||
      url.hostname.includes("tavily.com")) {
    return; // let it fall through to network
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses
        if (event.request.method === "GET" && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (event.request.destination === "document")
          return caches.match("/index.html");
      });
    })
  );
});
