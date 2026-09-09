import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apiUrl = process.env.API_URL ?? 'http://localhost:3000/api';
const email = `smoke-${Date.now()}@example.com`;

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json();
  const setCookie = response.headers.get('set-cookie');
  return {
    response,
    body,
    cookie: setCookie?.match(/(?:^|,\s*)(tb_refresh=[^;]+)/)?.[1] ?? null,
  };
}

try {
  const registration = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: 'smoke-password-123',
      firstName: 'Smoke',
      lastName: 'Test',
    }),
  });

  if (registration.response.status !== 201) {
    throw new Error(`Registration failed: ${registration.response.status}`);
  }
  if (!registration.cookie || registration.body.refreshToken) {
    throw new Error('Refresh token was not issued exclusively as an HttpOnly cookie');
  }

  const currentUser = await request('/auth/me', {
    headers: { authorization: `Bearer ${registration.body.accessToken}` },
  });
  if (currentUser.response.status !== 200 || currentUser.body.email !== email) {
    throw new Error(`Current-user request failed: ${currentUser.response.status}`);
  }

  const refreshed = await request('/auth/refresh', {
    method: 'POST',
    headers: {
      cookie: registration.cookie,
      origin: 'http://localhost:5173',
    },
  });
  if (refreshed.response.status !== 200 || !refreshed.cookie) {
    throw new Error(`Refresh rotation failed: ${refreshed.response.status}`);
  }
  if (refreshed.cookie === registration.cookie || refreshed.body.refreshToken) {
    throw new Error('Refresh rotation did not replace the secure cookie');
  }

  const reusedToken = await request('/auth/refresh', {
    method: 'POST',
    headers: {
      cookie: registration.cookie,
      origin: 'http://localhost:5173',
    },
  });
  if (reusedToken.response.status !== 401) {
    throw new Error(`Used refresh token was accepted: ${reusedToken.response.status}`);
  }

  const revokedFamily = await request('/auth/refresh', {
    method: 'POST',
    headers: {
      cookie: refreshed.cookie,
      origin: 'http://localhost:5173',
    },
  });
  if (revokedFamily.response.status !== 401) {
    throw new Error(`Compromised token family was accepted: ${revokedFamily.response.status}`);
  }

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'smoke-password-123' }),
  });
  if (login.response.status !== 200 || !login.cookie) {
    throw new Error(`Login failed: ${login.response.status}`);
  }

  const logout = await request('/auth/logout', {
    method: 'POST',
    headers: {
      cookie: login.cookie,
      origin: 'http://localhost:5173',
    },
  });
  if (logout.response.status !== 204) {
    throw new Error(`Logout failed: ${logout.response.status}`);
  }

  const loggedOutToken = await request('/auth/refresh', {
    method: 'POST',
    headers: {
      cookie: login.cookie,
      origin: 'http://localhost:5173',
    },
  });
  if (loggedOutToken.response.status !== 401) {
    throw new Error(`Logged-out token was accepted: ${loggedOutToken.response.status}`);
  }

  console.log('Auth smoke test passed');
} finally {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
}
