import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const input = process.env.SITE_URL || process.env.VITE_SITE_URL || process.env.WEB_URL || 'http://localhost:5173';
const siteUrl = new URL(input).origin;
const now = new Date().toISOString().slice(0, 10);
const target = resolve(process.cwd(), 'public', 'sitemap.xml');

await mkdir(resolve(process.cwd(), 'public'), { recursive: true });
await writeFile(target, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}/</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`);
