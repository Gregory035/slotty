import express from 'express';
import { configureProxy } from './proxy';
import { validateEnvironment } from './environment';

function clientIp(hops: number, forwarded: string) {
  const app = express();
  configureProxy(app, hops);
  const request = Object.create(app.request);
  request.socket = { remoteAddress: '172.18.0.6' };
  request.headers = { 'x-forwarded-for': forwarded };
  return request.ip;
}

describe('trusted proxy configuration', () => {
  it('ignores forwarded headers for a direct API', () => {
    expect(clientIp(0, '203.0.113.7')).toBe('172.18.0.6');
  });

  it('selects the client before Caddy and Nginx, not an extra spoofed entry', () => {
    expect(clientIp(2, '198.51.100.99, 203.0.113.7, 172.18.0.4')).toBe('203.0.113.7');
    expect(clientIp(2, '203.0.113.8, 172.18.0.4')).toBe('203.0.113.8');
  });

  it.each([-1, 3, 1.5, NaN])('rejects invalid hop count %s', (hops) => {
    expect(() => configureProxy(express(), hops)).toThrow('API_TRUST_PROXY_HOPS');
  });

  it('defaults to no trusted proxy and rejects unbounded trust', () => {
    const env = {
      DATABASE_URL: 'postgresql://test:test@localhost/test',
      JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32),
      BOT_TOKEN_ENCRYPTION_KEY: 'c'.repeat(32),
    };
    expect(validateEnvironment(env).API_TRUST_PROXY_HOPS).toBe(0);
    expect(validateEnvironment({ ...env, API_TRUST_PROXY_HOPS: '2' }).API_TRUST_PROXY_HOPS).toBe(2);
    expect(() => validateEnvironment({ ...env, API_TRUST_PROXY_HOPS: 'true' })).toThrow();
  });
});
