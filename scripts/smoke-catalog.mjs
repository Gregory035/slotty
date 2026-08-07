import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apiUrl = process.env.API_URL ?? 'http://localhost:3000/api';
const unique = Date.now();
const ownerEmail = `catalog-owner-${unique}@example.com`;
const companyIds = [];

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

async function expectStatus(result, status, message) {
  if (result.response.status !== status) {
    throw new Error(
      `${message}: expected ${status}, received ${result.response.status} ${JSON.stringify(result.body)}`,
    );
  }
  return result.body;
}

function bearer(accessToken) {
  return { authorization: `Bearer ${accessToken}` };
}

try {
  const registration = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: ownerEmail,
      password: 'smoke-password-123',
      firstName: 'Catalog owner',
    }),
  });
  const owner = await expectStatus(registration, 201, 'Registration failed');
  const headers = bearer(owner.accessToken);

  for (const name of ['Catalog A', 'Catalog B']) {
    const result = await request('/companies', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name }),
    });
    const company = await expectStatus(result, 201, 'Company creation failed');
    companyIds.push(company.id);
  }

  const [companyA, companyB] = companyIds;
  const serviceResult = await request(`/companies/${companyA}/services`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: '  Haircut  ',
      durationMinutes: 60,
      price: 2500,
      category: 'Hair',
    }),
  });
  const service = await expectStatus(serviceResult, 201, 'Service creation failed');
  if (service.name !== 'Haircut' || service.price !== '2500.00') {
    throw new Error('Service normalization failed');
  }

  const employeeResult = await request(`/companies/${companyA}/employees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: '  Elena  ',
      email: 'ELENA@EXAMPLE.COM',
      color: '#aabbcc',
    }),
  });
  const employee = await expectStatus(
    employeeResult,
    201,
    'Employee creation failed',
  );
  if (
    employee.firstName !== 'Elena' ||
    employee.email !== 'elena@example.com' ||
    employee.color !== '#AABBCC'
  ) {
    throw new Error('Employee normalization failed');
  }

  const assignmentResult = await request(
    `/companies/${companyA}/employees/${employee.id}/services/${service.id}`,
    { method: 'POST', headers },
  );
  const assigned = await expectStatus(
    assignmentResult,
    200,
    'Service assignment failed',
  );
  if (assigned.services.length !== 1 || assigned.services[0].id !== service.id) {
    throw new Error('Assigned service is missing from employee response');
  }

  const foreignService = await request(
    `/companies/${companyB}/services/${service.id}`,
    { headers },
  );
  await expectStatus(foreignService, 404, 'Cross-company service lookup was allowed');

  const companyBEmployeeResult = await request(
    `/companies/${companyB}/employees`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ firstName: 'Other employee' }),
    },
  );
  const companyBEmployee = await expectStatus(
    companyBEmployeeResult,
    201,
    'Second employee creation failed',
  );
  const foreignAssignment = await request(
    `/companies/${companyB}/employees/${companyBEmployee.id}/services/${service.id}`,
    { method: 'POST', headers },
  );
  await expectStatus(
    foreignAssignment,
    404,
    'Cross-company service assignment was allowed',
  );

  const updateService = await request(
    `/companies/${companyA}/services/${service.id}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ price: 2750, isActive: false }),
    },
  );
  const updatedService = await expectStatus(
    updateService,
    200,
    'Service update failed',
  );
  if (updatedService.price !== '2750.00' || updatedService.isActive !== false) {
    throw new Error('Service update was not persisted');
  }

  const unassignment = await request(
    `/companies/${companyA}/employees/${employee.id}/services/${service.id}`,
    { method: 'DELETE', headers },
  );
  const unassigned = await expectStatus(
    unassignment,
    200,
    'Service unassignment failed',
  );
  if (unassigned.services.length !== 0) {
    throw new Error('Service remained assigned to the employee');
  }

  await expectStatus(
    await request(`/companies/${companyA}/employees/${employee.id}`, {
      method: 'DELETE',
      headers,
    }),
    204,
    'Employee deletion failed',
  );
  await expectStatus(
    await request(`/companies/${companyA}/services/${service.id}`, {
      method: 'DELETE',
      headers,
    }),
    204,
    'Service deletion failed',
  );

  const [services, employees] = await Promise.all([
    request(`/companies/${companyA}/services`, { headers }),
    request(`/companies/${companyA}/employees`, { headers }),
  ]);
  await expectStatus(services, 200, 'Service list failed');
  await expectStatus(employees, 200, 'Employee list failed');
  if (services.body.length !== 0 || employees.body.length !== 0) {
    throw new Error('Soft-deleted records are visible in lists');
  }

  console.log('Catalog isolation smoke test passed');
} finally {
  if (companyIds.length > 0) {
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  }
  await prisma.user.deleteMany({ where: { email: ownerEmail } });
  await prisma.$disconnect();
}
