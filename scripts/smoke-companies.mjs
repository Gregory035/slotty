import { CompanyRole, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apiUrl = process.env.API_URL ?? 'http://localhost:3000/api';
const unique = Date.now();
const ownerEmail = `company-owner-${unique}@example.com`;
const employeeEmail = `company-employee-${unique}@example.com`;
let companyId;

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

async function register(email, firstName) {
  const result = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: 'smoke-password-123',
      firstName,
    }),
  });
  if (result.response.status !== 201) {
    throw new Error(`Registration failed: ${result.response.status}`);
  }
  return result.body;
}

function bearer(accessToken) {
  return { authorization: `Bearer ${accessToken}` };
}

try {
  const owner = await register(ownerEmail, 'Owner');
  const employee = await register(employeeEmail, 'Employee');

  const created = await request('/companies', {
    method: 'POST',
    headers: bearer(owner.accessToken),
    body: JSON.stringify({
      name: '  Smoke Company  ',
      timezone: 'Europe/Moscow',
      currency: 'rub',
      language: 'RU',
    }),
  });
  if (created.response.status !== 201 || created.body.role !== 'OWNER') {
    throw new Error(`Company creation failed: ${created.response.status}`);
  }
  companyId = created.body.id;

  const trialLength = new Date(created.body.trialEndsAt).getTime() - Date.now();
  if (trialLength < 13.9 * 24 * 60 * 60 * 1000) {
    throw new Error('Trial period is shorter than expected');
  }

  const ownerCompanies = await request('/companies', {
    headers: bearer(owner.accessToken),
  });
  if (
    ownerCompanies.response.status !== 200 ||
    ownerCompanies.body.length !== 1 ||
    ownerCompanies.body[0].id !== companyId
  ) {
    throw new Error('Company list is incorrect');
  }

  const denied = await request(`/companies/${companyId}`, {
    headers: bearer(employee.accessToken),
  });
  if (denied.response.status !== 403) {
    throw new Error(`Cross-tenant access was not denied: ${denied.response.status}`);
  }

  await prisma.companyMember.create({
    data: {
      companyId,
      userId: employee.user.id,
      role: CompanyRole.EMPLOYEE,
    },
  });

  const allowed = await request(`/companies/${companyId}`, {
    headers: bearer(employee.accessToken),
  });
  if (allowed.response.status !== 200 || allowed.body.role !== 'EMPLOYEE') {
    throw new Error('Employee membership access failed');
  }

  const employeeUpdate = await request(`/companies/${companyId}`, {
    method: 'PATCH',
    headers: bearer(employee.accessToken),
    body: JSON.stringify({ name: 'Forbidden update' }),
  });
  if (employeeUpdate.response.status !== 403) {
    throw new Error('EMPLOYEE was allowed to update the company');
  }

  const ownerUpdate = await request(`/companies/${companyId}`, {
    method: 'PATCH',
    headers: bearer(owner.accessToken),
    body: JSON.stringify({ name: 'Updated Smoke Company' }),
  });
  if (
    ownerUpdate.response.status !== 200 ||
    ownerUpdate.body.name !== 'Updated Smoke Company'
  ) {
    throw new Error('OWNER company update failed');
  }

  const members = await request(`/companies/${companyId}/members`, {
    headers: bearer(owner.accessToken),
  });
  if (members.response.status !== 200 || members.body.length !== 2) {
    throw new Error('Company member list is incorrect');
  }

  console.log('Company isolation smoke test passed');
} finally {
  if (companyId) {
    await prisma.company.deleteMany({ where: { id: companyId } });
  }
  await prisma.user.deleteMany({
    where: { email: { in: [ownerEmail, employeeEmail] } },
  });
  await prisma.$disconnect();
}
