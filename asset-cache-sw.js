// Versioned, same-origin immutable asset cache. Runtime code is not intercepted.
const PREFIX='tls-runtime-',CACHE=PREFIX+'081',ASSETS=new URL('assets/',self.registration.scope).href;
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith(PREFIX)&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET'||!req.url.startsWith(ASSETS)||req.headers.has('Range'))return;
 event.respondWith((async()=>{let cache;try{cache=await caches.open(CACHE);const cached=await cache.match(req);if(cached)return cached;}catch{}
 const response=await fetch(req);if(response.ok&&cache&&response.type==='basic'){try{await cache.put(req,response.clone());}catch{}}return response;})());
});
