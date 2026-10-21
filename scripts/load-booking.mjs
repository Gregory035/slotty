import { randomUUID } from 'node:crypto';

const api = (process.env.LOAD_TEST_API_URL || '').replace(/\/$/u, '');
const required = ['LOAD_TEST_EMAIL', 'LOAD_TEST_PASSWORD', 'LOAD_TEST_COMPANY_ID', 'LOAD_TEST_CUSTOMER_ID', 'LOAD_TEST_EMPLOYEE_ID', 'LOAD_TEST_SERVICE_ID'];
const missing = required.filter((key) => !process.env[key]);
if (!api || missing.length || process.env.LOAD_TEST_CONFIRM !== 'YES') {
  throw new Error(`Use a staging environment and set LOAD_TEST_CONFIRM=YES, LOAD_TEST_API_URL and: ${missing.join(', ')}`);
}
const concurrency = Math.min(100, Math.max(2, Number(process.env.LOAD_TEST_CONCURRENCY || 25)));
const startsAt = process.env.LOAD_TEST_STARTS_AT;
if (!startsAt || new Date(startsAt).getTime() < Date.now() + 3_600_000) {
  throw new Error('LOAD_TEST_STARTS_AT must be a valid future time at least one hour ahead');
}

const login = await request('/auth/login', {
  method: 'POST',
  body: { email: process.env.LOAD_TEST_EMAIL, password: process.env.LOAD_TEST_PASSWORD },
});
const path = `/companies/${process.env.LOAD_TEST_COMPANY_ID}/appointments`;
const attempts = await Promise.all(Array.from({ length: concurrency }, () => request(path, {
  method: 'POST',
  token: login.accessToken,
  headers: { 'idempotency-key': randomUUID() },
  body: {
    customerId: process.env.LOAD_TEST_CUSTOMER_ID,
    employeeId: process.env.LOAD_TEST_EMPLOYEE_ID,
    serviceId: process.env.LOAD_TEST_SERVICE_ID,
    startsAt,
  },
}, false)));
const statusCounts = attempts.reduce((counts, result) => {
  counts[result.status] = (counts[result.status] || 0) + 1;
  return counts;
}, {});
console.log(JSON.stringify({ concurrency, statusCounts }, null, 2));
if (statusCounts[201] !== 1 || Object.entries(statusCounts).some(([status, count]) => status !== '201' && status !== '409' && count > 0)) {
  process.exitCode = 1;
}

async function request(path, { method, body, token, headers = {} }, throwOnError = true) {
  const response = await fetch(`${api}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (throwOnError && !response.ok) throw new Error(`${response.status}: ${text}`);
  if (!throwOnError) return { status: response.status };
  return text ? JSON.parse(text) : null;
}
