import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apiUrl = process.env.API_URL ?? 'http://localhost:3000/api';
const webOrigin = process.env.WEB_URL ?? 'http://localhost:5173';
const unique = Date.now();
const ownerEmail = `booking-owner-${unique}@example.com`;
const employeeEmail = `booking-employee-${unique}@example.com`;
const companyIds = [];

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      origin: webOrigin,
      ...options.headers,
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

function nextMonday() {
  const date = new Date();
  const shortWeekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow',
    weekday: 'short',
  }).format(date);
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(shortWeekday) + 1;
  date.setUTCDate(date.getUTCDate() + (weekday === 1 ? 7 : 8 - weekday));
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

try {
  const owner = await expectStatus(
    await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: ownerEmail,
        password: 'smoke-password-123',
        firstName: 'Booking owner',
      }),
    }),
    201,
    'Owner registration failed',
  );
  const employeeUser = await expectStatus(
    await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: employeeEmail,
        password: 'smoke-password-123',
        firstName: 'Booking employee',
      }),
    }),
    201,
    'Employee registration failed',
  );
  const ownerHeaders = bearer(owner.accessToken);
  const employeeHeaders = bearer(employeeUser.accessToken);

  for (const name of ['Booking A', 'Booking B']) {
    const company = await expectStatus(
      await request('/companies', {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({ name, timezone: 'Europe/Moscow' }),
      }),
      201,
      'Company creation failed',
    );
    companyIds.push(company.id);
  }
  const [companyA, companyB] = companyIds;
  const service = await expectStatus(
    await request(`/companies/${companyA}/services`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ name: 'Consultation', durationMinutes: 60, price: 3000 }),
    }),
    201,
    'Service creation failed',
  );

  async function createEmployee(firstName) {
    const employee = await expectStatus(
      await request(`/companies/${companyA}/employees`, {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({ firstName }),
      }),
      201,
      'Employee creation failed',
    );
    await expectStatus(
      await request(`/companies/${companyA}/employees/${employee.id}/services/${service.id}`, {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({}),
      }),
      200,
      'Employee service assignment failed',
    );
    await expectStatus(
      await request(`/companies/${companyA}/employees/${employee.id}/schedule`, {
        method: 'PUT',
        headers: ownerHeaders,
        body: JSON.stringify({
          rules: [{ weekday: 1, startTime: '09:00', endTime: '18:00' }],
        }),
      }),
      200,
      'Schedule configuration failed',
    );
    return employee;
  }

  const employee = await createEmployee('Elena');
  const otherEmployee = await createEmployee('Olga');
  await expectStatus(
    await request(`/companies/${companyA}/members`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        email: employeeEmail,
        role: 'EMPLOYEE',
        employeeId: employee.id,
      }),
    }),
    201,
    'Employee membership failed',
  );

  const date = nextMonday();
  const start = (hour) => `${date}T${String(hour - 3).padStart(2, '0')}:00:00.000Z`;
  const bookingInput = {
    customer: { firstName: 'Smoke', lastName: 'Customer', phone: '+79990000000' },
    employeeId: employee.id,
    serviceId: service.id,
    startsAt: start(9),
    notes: 'E2E booking',
  };
  const idempotencyKey = `e2e-${unique}`;
  const created = await expectStatus(
    await request(`/companies/${companyA}/appointments`, {
      method: 'POST',
      headers: { ...ownerHeaders, 'idempotency-key': idempotencyKey },
      body: JSON.stringify(bookingInput),
    }),
    201,
    'Appointment creation failed',
  );
  const duplicate = await expectStatus(
    await request(`/companies/${companyA}/appointments`, {
      method: 'POST',
      headers: { ...ownerHeaders, 'idempotency-key': idempotencyKey },
      body: JSON.stringify(bookingInput),
    }),
    201,
    'Idempotent retry failed',
  );
  if (duplicate.id !== created.id) throw new Error('Idempotency key created a duplicate');

  const collisionInput = {
    customerId: created.customer.id,
    employeeId: employee.id,
    serviceId: service.id,
    startsAt: start(11),
  };
  const collision = await Promise.all([
    request(`/companies/${companyA}/appointments`, {
      method: 'POST',
      headers: { ...ownerHeaders, 'idempotency-key': `collision-a-${unique}` },
      body: JSON.stringify(collisionInput),
    }),
    request(`/companies/${companyA}/appointments`, {
      method: 'POST',
      headers: { ...ownerHeaders, 'idempotency-key': `collision-b-${unique}` },
      body: JSON.stringify(collisionInput),
    }),
  ]);
  const statuses = collision.map((result) => result.response.status).sort();
  if (statuses[0] !== 201 || statuses[1] !== 409) {
    throw new Error(`Concurrent booking protection failed: ${statuses.join(',')}`);
  }

  const other = await expectStatus(
    await request(`/companies/${companyA}/appointments`, {
      method: 'POST',
      headers: { ...ownerHeaders, 'idempotency-key': `other-${unique}` },
      body: JSON.stringify({
        customerId: created.customer.id,
        employeeId: otherEmployee.id,
        serviceId: service.id,
        startsAt: start(14),
      }),
    }),
    201,
    'Other employee appointment failed',
  );
  const employeePage = await expectStatus(
    await request(`/companies/${companyA}/appointments?limit=50`, { headers: employeeHeaders }),
    200,
    'Employee appointment list failed',
  );
  if (employeePage.items.some((item) => item.employee.id !== employee.id)) {
    throw new Error('EMPLOYEE received another employee appointment');
  }
  if (employeePage.items.some((item) => item.customer.phone || item.customer.telegramId)) {
    throw new Error('EMPLOYEE received restricted customer personal data');
  }
  await expectStatus(
    await request(`/companies/${companyA}/appointments/${other.id}/status`, {
      method: 'PATCH',
      headers: employeeHeaders,
      body: JSON.stringify({ status: 'CANCELLED_BY_COMPANY' }),
    }),
    403,
    'EMPLOYEE changed another employee appointment',
  );
  await expectStatus(
    await request(`/companies/${companyA}/employees/${otherEmployee.id}/schedule`, {
      headers: employeeHeaders,
    }),
    403,
    'EMPLOYEE read another employee schedule',
  );

  const rescheduled = await expectStatus(
    await request(`/companies/${companyA}/appointments/${created.id}/reschedule`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ startsAt: start(10) }),
    }),
    200,
    'Appointment reschedule failed',
  );
  if (rescheduled.startsAt !== start(10)) throw new Error('Reschedule was not persisted');
  await expectStatus(
    await request(`/companies/${companyB}/appointments/${created.id}/status`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ status: 'CANCELLED_BY_COMPANY' }),
    }),
    404,
    'Cross-tenant appointment mutation was allowed',
  );
  await expectStatus(
    await request(`/companies/${companyA}/appointments/${created.id}/status`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ status: 'CANCELLED_BY_COMPANY', cancellationReason: 'E2E' }),
    }),
    200,
    'Appointment cancellation failed',
  );
  await expectStatus(
    await request(`/companies/${companyA}/appointments/${created.id}/status`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ status: 'CONFIRMED' }),
    }),
    409,
    'Final appointment status was reopened',
  );
  const history = await expectStatus(
    await request(`/companies/${companyA}/appointments/${created.id}/history`, {
      headers: ownerHeaders,
    }),
    200,
    'Appointment history failed',
  );
  if (!history.some((item) => item.action === 'RESCHEDULED')) {
    throw new Error('Reschedule history is missing');
  }

  console.log('Booking, tenant and employee permission E2E passed');
} finally {
  if (companyIds.length) {
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, employeeEmail] } } });
  await prisma.$disconnect();
}
