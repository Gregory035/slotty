import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const port = Number(process.env.PORT || 18082);
const redirects = new Map([
  ['/online-zapis/', '/online-zapis'],
  ['/zapis-cherez-telegram/', '/zapis-cherez-telegram'],
  ['/app/', '/app'],
]);
const documents = new Map([
  ['/', ['index.html', 200, false]],
  ['/online-zapis', ['online-zapis/index.html', 200, false]],
  ['/zapis-cherez-telegram', ['zapis-cherez-telegram/index.html', 200, false]],
  ['/app', ['private.html', 200, true]],
]);

createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const redirect = redirects.get(url.pathname);
  if (redirect) {
    response.writeHead(308, { location: `${redirect}${url.search}` }).end();
    return;
  }

  const companyRoute = /^\/companies\/[^/]+\/[^/]+$/.test(url.pathname);
  const document = companyRoute ? ['private.html', 200, true] : documents.get(url.pathname);
  if (document) {
    await send(response, document[0], document[1], document[2]);
    return;
  }

  if (url.pathname === '/robots.txt' || url.pathname === '/sitemap.xml' || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/og/') || url.pathname.startsWith('/brand/') || url.pathname === '/slotty-favicon.png') {
    const relative = decodeURIComponent(url.pathname.slice(1));
    const file = resolve(dist, relative);
    if (file.startsWith(`${dist}${sep}`) && await isFile(file)) {
      await send(response, relative, 200, false);
      return;
    }
  }

  await send(response, '404.html', 404, true);
}).listen(port, '127.0.0.1', () => console.log(`Slotty SEO preview: http://127.0.0.1:${port}`));

async function send(response, relative, status, noindex) {
  const file = resolve(dist, relative);
  const body = await readFile(file);
  const headers = { 'content-type': contentType(file), 'cache-control': relative.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' };
  if (noindex) headers['x-robots-tag'] = 'noindex, nofollow';
  response.writeHead(status, headers).end(body);
}

async function isFile(file) {
  try { return (await stat(file)).isFile(); } catch { return false; }
}

function contentType(file) {
  return ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' })[extname(file)] || 'application/octet-stream';
}
