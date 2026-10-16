// Online-first release: do not cache recognition models or external runtime assets.
// This avoids mixing old model weights with newer labels or preprocessing.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.mode!=='navigate')return;
 event.respondWith(fetch(event.request).catch(()=>new Response(
  '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SignConnect — reconnect</title><body style="background:#fff1f5;color:#422735;font:18px system-ui;padding:40px"><h1>Let’s reconnect.</h1><p>SignConnect needs its website and an internet connection to load camera recognition.</p><p>If you installed from your laptop, start its Python server again.</p><button onclick="location.reload()">Try again</button></body></html>',
  {status:503,headers:{'Content-Type':'text/html; charset=utf-8'}})));
});
