import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateSeoConfiguration } from './seo-config.mjs';

const root = process.cwd();
const dist = resolve(root, 'dist');
const ssrEntry = resolve(root, '.seo-ssr', 'entry-server.js');
const { renderPage, seoPages, structuredData } = await import(pathToFileURL(ssrEntry).href);
const template = await readFile(resolve(dist, 'index.html'), 'utf8');
const publicTemplate = await inlinePublicCss(template);
const indexingEnabled = process.env.SEO_INDEXING_ENABLED === 'true';
const configuredUrl = process.env.VITE_SITE_URL || process.env.SITE_URL || process.env.WEB_URL || '';
const origin = validateSeoConfiguration(configuredUrl, indexingEnabled);

for (const page of seoPages) {
  const output = page.path === '/' ? resolve(dist, 'index.html') : resolve(dist, page.path.slice(1), 'index.html');
  await mkdir(resolve(output, '..'), { recursive: true });
  await writeFile(output, renderDocument(publicTemplate, page, renderPage(page.path), origin, indexingEnabled, structuredData(page.path, origin)));
}

await writeFile(resolve(dist, 'private.html'), renderPrivateDocument(template));
await writeFile(resolve(dist, '404.html'), renderNotFoundDocument(publicTemplate, renderPage('/404')));
await writeFile(resolve(dist, 'robots.txt'), indexingEnabled
  ? `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`
  : 'User-agent: *\nAllow: /\n');

const sitemapPath = resolve(dist, 'sitemap.xml');
if (indexingEnabled) {
  const urls = seoPages.map((page) => `  <url><loc>${xml(`${origin}${page.path}`)}</loc></url>`).join('\n');
  await writeFile(sitemapPath, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
} else {
  await unlink(sitemapPath).catch((error) => { if (error?.code !== 'ENOENT') throw error; });
  console.warn('SEO indexing is disabled; generated HTML is noindex and sitemap.xml was omitted.');
}

function renderDocument(source, page, appHtml, siteOrigin, enabled, schemas) {
  const canonical = `${siteOrigin}${page.path}`;
  const image = `${siteOrigin}${page.ogImage}`;
  const robots = enabled ? 'index,follow,max-image-preview:large' : 'noindex,nofollow';
  const block = [
    `<meta name="description" content="${html(page.description)}" />`,
    `<meta name="robots" content="${robots}" />`,
    enabled ? `<link rel="canonical" href="${html(canonical)}" />` : '',
    enabled ? '<meta property="og:type" content="website" />' : '',
    enabled ? '<meta property="og:locale" content="ru_RU" />' : '',
    enabled ? `<meta property="og:title" content="${html(page.title)}" />` : '',
    enabled ? `<meta property="og:description" content="${html(page.description)}" />` : '',
    enabled ? `<meta property="og:url" content="${html(canonical)}" />` : '',
    enabled ? `<meta property="og:image" content="${html(image)}" />` : '',
    enabled ? '<meta property="og:image:width" content="1200" />' : '',
    enabled ? '<meta property="og:image:height" content="630" />' : '',
    enabled ? '<meta property="og:image:alt" content="Slotty — онлайн-запись через Telegram" />' : '',
    enabled ? '<meta name="twitter:card" content="summary_large_image" />' : '',
    enabled ? `<meta name="twitter:title" content="${html(page.title)}" />` : '',
    enabled ? `<meta name="twitter:description" content="${html(page.description)}" />` : '',
    enabled ? `<meta name="twitter:image" content="${html(image)}" />` : '',
    `<title>${html(page.title)}</title>`,
    enabled ? `<script type="application/ld+json" data-slotty-seo="true">${JSON.stringify(schemas).replaceAll('<', '\\u003c')}</script>` : '',
  ].filter(Boolean).join('\n    ');
  return replace(source, block, appHtml);
}

function renderPrivateDocument(source) {
  const block = '<meta name="description" content="Рабочее пространство Slotty." />\n    <meta name="robots" content="noindex,nofollow" />\n    <title>Slotty — рабочее пространство</title>';
  return replace(source, block, '');
}

function renderNotFoundDocument(source, appHtml) {
  const block = '<meta name="description" content="Запрошенная страница Slotty не найдена." />\n    <meta name="robots" content="noindex,nofollow" />\n    <title>Страница не найдена — Slotty</title>';
  return replace(source, block, appHtml);
}

function replace(source, seoBlock, appHtml) {
  return source
    .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, `<!--seo:start-->\n    ${seoBlock}\n    <!--seo:end-->`)
    .replace('<!--app-html-->', appHtml);
}

function html(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function xml(value) {
  return html(value).replaceAll("'", '&apos;');
}

async function inlinePublicCss(source) {
  const match = source.match(/<link rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/);
  if (!match) throw new Error('Public stylesheet link was not found in the Vite output.');
  const css = await readFile(resolve(dist, match[1].replace(/^\//, '')), 'utf8');
  return source.replace(match[0], `<style data-slotty-public-css>${css.replaceAll('</style', '<\\/style')}</style>`);
}
