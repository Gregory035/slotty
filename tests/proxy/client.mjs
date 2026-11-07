import assert from 'node:assert/strict';
import os from 'node:os';

const ips = Object.values(os.networkInterfaces()).flat().filter((address) => address && !address.internal).map((address) => address.address);
for (let attempt = 0; attempt < 3; attempt += 1) {
  const response = await fetch('http://caddy/api/proxy-test', {
    headers: { 'x-forwarded-for': `198.51.100.${attempt + 1}`, 'x-real-ip': '198.51.100.9' },
  });
  assert.equal(response.status, attempt < 2 ? 200 : 429);
  if (attempt < 2) {
    const { ip } = await response.json();
    assert.ok(ips.includes(ip), `Expected actual client IP, received ${ip}`);
  } else {
    assert.ok(Number(response.headers.get('retry-after')) > 0);
  }
}
console.log('Independent client bucket and rejection of spoofed IP headers: passed');
