const CACHE = 'resonanz-v3';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['./','./index.html']).catch(()=>{}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Handle Share Target (POST from WhatsApp/Signal etc.)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (e.request.method === 'POST' && url.searchParams.has('share')) {
    e.respondWith(handleShare(e.request));
    return;
  }

  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});

async function handleShare(req) {
  try {
    const fd = await req.formData();
    const text = fd.get('text') || fd.get('url') || fd.get('title') || '';
    const audioFiles = fd.getAll('audio');
    const sc = await caches.open('resonanz-share');

    if (text) {
      await sc.put('/__share_text', new Response(
        JSON.stringify({ text, ts: Date.now() }),
        { headers: { 'Content-Type': 'application/json' } }
      ));
    }

    if (audioFiles.length) {
      const meta = audioFiles.map((f, i) => ({ name: f.name, type: f.type, idx: i }));
      await sc.put('/__share_audio_meta', new Response(
        JSON.stringify({ files: meta, ts: Date.now() }),
        { headers: { 'Content-Type': 'application/json' } }
      ));
      for (let i = 0; i < audioFiles.length; i++) {
        const ab = await audioFiles[i].arrayBuffer();
        await sc.put('/__share_audio_' + i, new Response(ab, {
          headers: {
            'Content-Type': audioFiles[i].type || 'audio/ogg',
            'X-Filename': audioFiles[i].name
          }
        }));
      }
    }
  } catch (err) {
    console.error('Share target error:', err);
  }
  return Response.redirect('./?shared=1', 303);
}
