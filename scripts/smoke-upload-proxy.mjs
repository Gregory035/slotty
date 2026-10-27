// Exercises the actual reverse proxy. Authentication must reject these requests
// before image processing; no user, bot, or Telegram profile is modified.
const origin = process.env.UPLOAD_PROXY_ORIGIN;
if (!origin) throw new Error('Set UPLOAD_PROXY_ORIGIN to the Docker or production web origin');
const path = '/api/companies/00000000-0000-4000-8000-000000000001/bots/00000000-0000-4000-8000-000000000002/profile-photo';

for (const size of [1_105_194, 5 * 1024 * 1024]) {
  const body = new FormData();
  body.set('photo', new Blob([new Uint8Array(size)], { type: 'image/png' }), 'proxy-test.png');
  const response = await fetch(new URL(path, origin), { method: 'POST', body, signal: AbortSignal.timeout(30_000) });
  if (response.status !== 401) throw new Error(`Upload proxy rejected ${size} bytes before authentication: HTTP ${response.status}`);
  console.log(`Upload proxy accepts ${size} file bytes; API authentication returns 401 as expected`);
}

const response = await fetch(new URL(path, origin), {
  method: 'POST',
  headers: { 'content-type': 'application/octet-stream' },
  body: new Uint8Array(7 * 1024 * 1024),
  signal: AbortSignal.timeout(30_000),
});
if (response.status !== 413) throw new Error(`Expected 413 above the proxy limit, received ${response.status}`);
const error = await response.json();
if (!error.message?.includes('5 МБ')) throw new Error('Proxy must return an actionable JSON upload error');
console.log('Oversized payload is rejected with 413 and a readable JSON error');
