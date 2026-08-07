import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apiUrl = process.env.API_URL ?? 'http://localhost:3000/api';
const email = `smoke-${Date.now()}@example.com`;

async function request(path, options) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options?.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
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

  const currentUser = await request('/auth/me', {
    headers: { authorization: `Bearer ${registration.body.accessToken}` },
  });
  if (currentUser.response.status !== 200 || currentUser.body.email !== email) {
    throw new Error(`Current-user request failed: ${currentUser.response.status}`);
  }

  const refreshed = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: registration.body.refreshToken }),
  });
  if (
    refreshed.response.status !== 200 ||
    refreshed.body.refreshToken === registration.body.refreshToken
  ) {
    throw new Error(`Refresh rotation failed: ${refreshed.response.status}`);
  }

  const reusedToken = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: registration.body.refreshToken }),
  });
  if (reusedToken.response.status !== 401) {
    throw new Error(`Used refresh token was accepted: ${reusedToken.response.status}`);
  }

  const logout = await request('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refreshed.body.refreshToken }),
  });
  if (logout.response.status !== 204) {
    throw new Error(`Logout failed: ${logout.response.status}`);
  }

  const loggedOutToken = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refreshed.body.refreshToken }),
  });
  if (loggedOutToken.response.status !== 401) {
    throw new Error(`Logged-out token was accepted: ${loggedOutToken.response.status}`);
  }

  console.log('Auth smoke test passed');
} finally {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
}
