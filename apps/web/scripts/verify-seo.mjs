import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const enabled = process.env.SEO_INDEXING_ENABLED === 'true';
const origin = (process.env.VITE_SITE_URL || process.env.SITE_URL || process.env.WEB_URL || '').replace(/\/$/, '');
const routes = ['/', '/online-zapis', '/zapis-cherez-telegram', '/dlya-mastera', '/dlya-salona', '/privacy', '/terms', '/personal-data', '/offer', '/cookies', '/data-processing'];
const documents = [];

for (const route of routes) {
  const path = route === '/' ? resolve(dist, 'index.html') : resolve(dist, route.slice(1), 'index.html');
  const source = await readFile(path, 'utf8');
  assert.match(source, /<h1[> ]/i, `${route} must contain a prerendered h1`);
  assert.doesNotMatch(source, /The server did not finish this Suspense boundary|Switched to client rendering/i, `${route} must not ship an unfinished prerender`);
  assert.doesNotMatch(source, /meta name="keywords"/i);
  const title = source.match(/<title>(.*?)<\/title>/)?.[1];
  const description = source.match(/<meta name="description" content="([^"]+)"/i)?.[1];
  assert.ok(title && description, `${route} must contain title and description`);
  documents.push({ route, source, title, description });
  if (enabled) {
    assert.match(source, /<meta name="robots" content="index,follow(?:,max-image-preview:large)?"/, `${route} must allow indexing`);
    assert.equal([...source.matchAll(/<meta\b[^>]*\bname="robots"/gi)].length, 1, `${route} must have one robots directive`);
    assert.equal([...source.matchAll(/<link\b[^>]*\brel="canonical"/gi)].length, 1, `${route} must have one canonical`);
    assert.match(source, new RegExp(`<link rel="canonical" href="${escapeRegExp(`${origin}${route}`)}"`));
    assert.match(source, /<meta property="og:image" content="https:\/\//);
    const jsonLd = [...source.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)];
    assert.ok(jsonLd.length > 0, `${route} must contain JSON-LD`);
    for (const match of jsonLd) JSON.parse(match[1]);
    assert.doesNotMatch(source, /localhost|example\.(?:com|org|net)/i);
  } else {
    assert.match(source, /<meta name="robots" content="noindex,nofollow"/);
    assert.doesNotMatch(source, /rel="canonical"/);
  }
}

assert.equal(new Set(documents.map((item) => item.title)).size, routes.length, 'public titles must be unique');
assert.equal(new Set(documents.map((item) => item.description)).size, routes.length, 'public descriptions must be unique');
// Secondary pages must remain separate from the landing entry and its preloads.
const home = documents[0].source;
const startupScripts = [...home.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="(\/assets\/[^"]+\.js)"[^>]*>/g)];
for (const [, asset] of startupScripts) {
  assert.doesNotMatch(asset, /LegalPage|AudiencePages|OnlineBookingPage|TelegramBookingPage/, 'secondary pages must not be preloaded on home');
  const script = await readFile(resolve(dist, asset.slice(1)), 'utf8');
  assert.ok(!script.includes('Политика объясняет, какие данные обрабатывает Slotty'), 'legal document content must not be in the landing startup bundle');
}
for (const file of ['private.html', '404.html']) {
  const source = await readFile(resolve(dist, file), 'utf8');
  assert.match(source, /<meta name="robots" content="noindex,nofollow"/);
  assert.doesNotMatch(source, /rel="canonical"|application\/ld\+json/);
}

const robots = await readFile(resolve(dist, 'robots.txt'), 'utf8');
assert.match(robots, /^Allow: \/$/m);
assert.doesNotMatch(robots, /^\s*Disallow:\s*\S/im, 'crawlers must be able to read noindex');
if (enabled) {
  assert.match(robots, new RegExp(`^Sitemap: ${escapeRegExp(origin)}/sitemap\\.xml$`, 'm'));
  const sitemap = await readFile(resolve(dist, 'sitemap.xml'), 'utf8');
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locations, routes.map((route) => `${origin}${route}`));
  assert.doesNotMatch(sitemap, /localhost|example\.|\/app|\/companies|[?&](?:token|code)=/i);
  assert.doesNotMatch(sitemap, /<lastmod>/i);
} else {
  assert.doesNotMatch(robots, /^Sitemap:/im);
  await assert.rejects(access(resolve(dist, 'sitemap.xml')), { code: 'ENOENT' });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
