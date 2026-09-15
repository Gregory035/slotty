export function validateSeoConfiguration(value, enabled) {
  if (!enabled) return '';
  if (!value) throw new Error('SEO_INDEXING_ENABLED=true requires WEB_URL/VITE_SITE_URL.');
  const url = new URL(value);
  const forbidden = url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname === '127.0.0.1' || url.hostname === '::1' || url.hostname.includes('example.');
  if (url.protocol !== 'https:' || forbidden || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Indexable SEO builds require a public HTTPS origin without credentials, path, query or hash.');
  }
  return url.origin;
}
