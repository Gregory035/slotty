import {
  AppointmentSource,
  AppointmentStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();
const apiUrl = process.env.API_URL ?? 'http://localhost:3000/api';
const unique = Date.now();
const ownerEmail = `schedule-owner-${unique}@example.com`;
const companyIds = [];

function nextMonday() {
  const date = new Date();
  const shortWeekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow',
    weekday: 'short',
  }).format(date);
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(shortWeekday) + 1;
  date.setUTCDate(date.getUTCDate() + (weekday === 1 ? 7 : 8 - weekday));
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

const targetDate = nextMonday();

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

function availabilityPath(companyId, employeeId, serviceId) {
  const query = new URLSearchParams({
    employeeId,
    serviceId,
    date: targetDate,
    stepMinutes: '30',
  });
  return `/companies/${companyId}/availability?${query}`;
}

try {
  const owner = await expectStatus(
    await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: ownerEmail,
        password: 'smoke-password-123',
        firstName: 'Schedule owner',
      }),
    }),
    201,
    'Registration failed',
  );
  const headers = bearer(owner.accessToken);

  for (const name of ['Schedule A', 'Schedule B']) {
    const company = await expectStatus(
      await request('/companies', {
        method: 'POST',
        headers,
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
      headers,
      body: JSON.stringify({
        name: 'Consultation',
        durationMinutes: 60,
        price: 3000,
      }),
    }),
    201,
    'Service creation failed',
  );
  const employee = await expectStatus(
    await request(`/companies/${companyA}/employees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ firstName: 'Elena' }),
    }),
    201,
    'Employee creation failed',
  );
  await expectStatus(
    await request(
      `/companies/${companyA}/employees/${employee.id}/services/${service.id}`,
      { method: 'POST', headers },
    ),
    200,
    'Service assignment failed',
  );

  const schedulePath = `/companies/${companyA}/employees/${employee.id}/schedule`;
  const schedule = await expectStatus(
    await request(schedulePath, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        rules: [
          { weekday: 1, startTime: '09:00', endTime: '12:00' },
          { weekday: 1, startTime: '13:00', endTime: '18:00' },
        ],
      }),
    }),
    200,
    'Schedule replacement failed',
  );
  if (schedule.length !== 2 || schedule[0].weekday !== 1) {
    throw new Error('Weekly schedule is incorrect');
  }

  const overlappingSchedule = await request(schedulePath, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      rules: [
        { weekday: 1, startTime: '09:00', endTime: '12:00' },
        { weekday: 1, startTime: '11:00', endTime: '13:00' },
      ],
    }),
  });
  await expectStatus(
    overlappingSchedule,
    400,
    'Overlapping schedule was accepted',
  );

  const initialAvailability = await expectStatus(
    await request(availabilityPath(companyA, employee.id, service.id), {
      headers,
    }),
    200,
    'Availability calculation failed',
  );
  if (initialAvailability.slots.length !== 14) {
    throw new Error(
      `Expected 14 slots, received ${initialAvailability.slots.length}`,
    );
  }

  const customer = await prisma.customer.create({
    data: {
      companyId: companyA,
      telegramId: BigInt(unique),
      firstName: 'Smoke customer',
    },
  });
  await prisma.appointment.create({
    data: {
      companyId: companyA,
      customerId: customer.id,
      employeeId: employee.id,
      serviceId: service.id,
      startsAt: new Date(`${targetDate}T07:00:00.000Z`),
      endsAt: new Date(`${targetDate}T08:00:00.000Z`),
      status: AppointmentStatus.CONFIRMED,
      source: AppointmentSource.DASHBOARD,
      priceSnapshot: new Prisma.Decimal(3000),
      durationMinutesSnapshot: 60,
    },
  });

  const busyAvailability = await expectStatus(
    await request(availabilityPath(companyA, employee.id, service.id), {
      headers,
    }),
    200,
    'Busy-slot calculation failed',
  );
  if (busyAvailability.slots.length !== 11) {
    throw new Error(
      `Expected 11 free slots, received ${busyAvailability.slots.length}`,
    );
  }

  const customHours = await expectStatus(
    await request(`${schedulePath}/exceptions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        date: targetDate,
        type: 'CUSTOM_HOURS',
        startTime: '10:00',
        endTime: '12:00',
      }),
    }),
    201,
    'Custom-hours exception creation failed',
  );
  const customAvailability = await expectStatus(
    await request(availabilityPath(companyA, employee.id, service.id), {
      headers,
    }),
    200,
    'Custom-hours calculation failed',
  );
  if (
    customAvailability.slots.length !== 1 ||
    !customAvailability.slots[0].startsAt.endsWith('08:00:00.000Z')
  ) {
    throw new Error('Custom hours did not override the weekly schedule');
  }

  const dayOff = await expectStatus(
    await request(`${schedulePath}/exceptions/${customHours.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ type: 'DAY_OFF' }),
    }),
    200,
    'Exception update failed',
  );
  if (dayOff.type !== 'DAY_OFF' || dayOff.startTime !== null) {
    throw new Error(
      `Custom hours were not converted to a full-day exception: ${JSON.stringify(dayOff)}`,
    );
  }
  const dayOffAvailability = await expectStatus(
    await request(availabilityPath(companyA, employee.id, service.id), {
      headers,
    }),
    200,
    'Day-off calculation failed',
  );
  if (dayOffAvailability.slots.length !== 0) {
    throw new Error('Day off still contains available slots');
  }

  const exceptions = await expectStatus(
    await request(`${schedulePath}/exceptions?from=${targetDate}&to=${targetDate}`, {
      headers,
    }),
    200,
    'Exception list failed',
  );
  if (exceptions.length !== 1 || exceptions[0].id !== dayOff.id) {
    throw new Error('Exception list is incorrect');
  }

  await expectStatus(
    await request(`${schedulePath}/exceptions/${dayOff.id}`, {
      method: 'DELETE',
      headers,
    }),
    204,
    'Exception deletion failed',
  );

  const foreignAvailability = await request(
    availabilityPath(companyB, employee.id, service.id),
    { headers },
  );
  await expectStatus(
    foreignAvailability,
    404,
    'Cross-company availability lookup was allowed',
  );

  console.log('Scheduling and availability smoke test passed');
} finally {
  if (companyIds.length > 0) {
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  }
  await prisma.user.deleteMany({ where: { email: ownerEmail } });
  await prisma.$disconnect();
}
