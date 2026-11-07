import type { Application } from 'express';

export function configureProxy(app: Application, hops: number): void {
  // Only enable this behind the documented, private Caddy -> Nginx path.
  // Direct/local API instances must ignore client-supplied forwarded headers.
  if (!Number.isInteger(hops) || hops < 0 || hops > 2) {
    throw new Error('API_TRUST_PROXY_HOPS must be 0, 1 or 2');
  }
  app.set('trust proxy', hops);
}
