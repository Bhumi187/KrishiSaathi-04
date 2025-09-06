/* Simple offline-first service worker */
const CACHE = "ks-cache-v1";
const OFFLINE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./db.js",
  "./manifest.json",
  "./dummy/data.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (evt)=>{
  evt.waitUntil(caches.open(CACHE).then(c=>c.addAll(OFFLINE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (evt)=>{
  evt.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=> k===CACHE?null:caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evt)=>{
  const req = evt.request;
  // Cache-first for same-origin GETs
  if(req.method === "GET" && new URL(req.url).origin === location.origin){
    evt.respondWith(
      caches.match(req).then(cached=>{
        const fetchPromise = fetch(req).then(res=>{
          const resClone = res.clone();
          caches.open(CACHE).then(cache=> cache.put(req, resClone));
          return res;
        }).catch(()=> cached);
        return cached || fetchPromise;
      })
    );
  }
});
