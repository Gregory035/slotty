import assert from 'node:assert/strict';

const origin = process.env.SECURITY_PROXY_ORIGIN;
if (!origin) throw new Error('Set SECURITY_PROXY_ORIGIN');
const routes = [
  ['/', 200], ['/app', 200], ['/app?mode=register', 200],
  ['/companies/00000000-0000-4000-8000-000000000001/dashboard', 200],
  ['/miniapp/00000000-0000-4000-8000-000000000001', 200],
  ['/company/test-company', 200], ['/app/', 308],
  ['/missing-security-check', 404], ['/missing-security-check.js', 404],
  ['/robots.txt', 200], ['/sw.js', 200], ['/site.webmanifest', 200],
];
for (const [path, status] of routes) {
  const response = await fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, status, path);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff', path);
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin', path);
  assert.ok(response.headers.get('permissions-policy'), path);
  const csp = response.headers.get('content-security-policy');
  assert.ok(csp?.includes("script-src 'self'"), path);
  assert.ok(csp?.includes("img-src 'self' data: blob: https:"), `${path}: local photo previews`);
  const frames = csp?.match(/frame-ancestors ([^;]+)/)?.[1];
  assert.equal(frames, path.startsWith('/miniapp/') ? "'self' https://web.telegram.org" : "'self'", path);
  if (status === 404 || ['/app', '/companies/', '/miniapp/', '/company/'].some((prefix) => path.startsWith(prefix)) && status === 200) {
    assert.equal(response.headers.get('cache-control'), 'no-store', path);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', path);
  }
  if (path === '/sw.js') assert.equal(response.headers.get('cache-control'), 'no-cache');
  await response.body?.cancel();
}
console.log(`Security headers, framing, cache and noindex: ${routes.length} HTTP routes passed`);
