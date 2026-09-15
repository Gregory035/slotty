import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const enabled = process.env.SEO_INDEXING_ENABLED === 'true';
const origin = (process.env.VITE_SITE_URL || process.env.SITE_URL || process.env.WEB_URL || '').replace(/\/$/, '');
const routes = ['/', '/online-zapis', '/zapis-cherez-telegram'];
const documents = [];

for (const route of routes) {
  const path = route === '/' ? resolve(dist, 'index.html') : resolve(dist, route.slice(1), 'index.html');
  const source = await readFile(path, 'utf8');
  assert.match(source, /<h1[> ]/i, `${route} must contain a prerendered h1`);
  assert.doesNotMatch(source, /meta name="keywords"/i);
  const title = source.match(/<title>(.*?)<\/title>/)?.[1];
  const description = source.match(/<meta name="description" content="([^"]+)"/i)?.[1];
  assert.ok(title && description, `${route} must contain title and description`);
  documents.push({ route, source, title, description });
  if (enabled) {
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
for (const file of ['private.html', '404.html']) {
  const source = await readFile(resolve(dist, file), 'utf8');
  assert.match(source, /<meta name="robots" content="noindex,nofollow"/);
  assert.doesNotMatch(source, /rel="canonical"|application\/ld\+json/);
}

if (enabled) {
  const sitemap = await readFile(resolve(dist, 'sitemap.xml'), 'utf8');
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locations, routes.map((route) => `${origin}${route}`));
  assert.doesNotMatch(sitemap, /localhost|example\.|\/app|\/companies|[?&](?:token|code)=/i);
  assert.doesNotMatch(sitemap, /<lastmod>/i);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
