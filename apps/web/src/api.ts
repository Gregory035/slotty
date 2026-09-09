import type {
  Appointment,
  AppointmentStatus,
  AuditLog,
  Company,
  CompanyMember,
  CursorPage,
  Customer,
  CustomerDetails,
  Dashboard,
  Employee,
  Entitlements,
  Payment,
  ScheduleException,
  ScheduleExceptionType,
  ScheduleRule,
  ReviewDashboard,
  Service,
  Session,
  TelegramBot,
} from './types';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
let currentSession: Session | null = null;
let refreshPromise: Promise<Session> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function readSession(): Session | null {
  return currentSession;
}

export function writeSession(session: Session | null): void {
  currentSession = session;
}

async function responseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    const message = Array.isArray(body.message)
      ? body.message.join('. ')
      : body.message;
    return new ApiError(message || 'Не удалось выполнить запрос', response.status);
  } catch {
    return new ApiError('Не удалось выполнить запрос', response.status);
  }
}

async function responseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.text();
  return (body ? JSON.parse(body) : null) as T;
}

async function publicRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) throw await responseError(response);
  return responseBody<T>(response);
}

async function refreshSession(): Promise<Session> {
  if (!refreshPromise) {
    refreshPromise = publicRequest<Session>('/auth/refresh', {
      method: 'POST',
    }).finally(() => {
      refreshPromise = null;
    });
  }
  const session = await refreshPromise;
  writeSession(session);
  return session;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const session = readSession();
  if (!session) throw new ApiError('Войдите в аккаунт', 401);
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      authorization: `Bearer ${session.accessToken}`,
      ...options.headers,
    },
  });
  if (response.status === 401 && !retried) {
    try {
      await refreshSession();
      return request<T>(path, options, true);
    } catch {
      writeSession(null);
      window.dispatchEvent(new Event('auth-expired'));
      throw new ApiError('Сессия завершена. Войдите снова', 401);
    }
  }
  if (!response.ok) throw await responseError(response);
  return responseBody<T>(response);
}

export function login(input: { email: string; password: string }): Promise<Session> {
  return publicRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function register(input: {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
}): Promise<Session> {
  return publicRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function restoreSession(): Promise<Session | null> {
  try {
    return await refreshSession();
  } catch {
    writeSession(null);
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await publicRequest('/auth/logout', { method: 'POST' });
  } finally {
    writeSession(null);
  }
}

export const getCompanies = () => request<Company[]>('/companies');

export const createCompany = (input: {
  name: string;
  timezone: string;
  currency: string;
}) =>
  request<Company>('/companies', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const getServices = (companyId: string) =>
  request<Service[]>(`/companies/${companyId}/services`);

export const createService = (
  companyId: string,
  input: {
    name: string;
    durationMinutes: number;
    price: number;
    depositPercent?: number;
    depositFixedAmount?: number;
    category?: string;
    description?: string;
  },
) =>
  request<Service>(`/companies/${companyId}/services`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const deleteService = (companyId: string, serviceId: string) =>
  request<void>(`/companies/${companyId}/services/${serviceId}`, {
    method: 'DELETE',
  });

export const getEmployees = (companyId: string) =>
  request<Employee[]>(`/companies/${companyId}/employees`);

export const createEmployee = (
  companyId: string,
  input: {
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
    description?: string;
    color?: string;
  },
) =>
  request<Employee>(`/companies/${companyId}/employees`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const assignEmployeeService = (
  companyId: string,
  employeeId: string,
  serviceId: string,
) =>
  request<Employee>(
    `/companies/${companyId}/employees/${employeeId}/services/${serviceId}`,
    { method: 'POST' },
  );

export const deleteEmployee = (companyId: string, employeeId: string) =>
  request<void>(`/companies/${companyId}/employees/${employeeId}`, {
    method: 'DELETE',
  });

export const getSchedule = (companyId: string, employeeId: string) =>
  request<ScheduleRule[]>(
    `/companies/${companyId}/employees/${employeeId}/schedule`,
  );

export const replaceSchedule = (
  companyId: string,
  employeeId: string,
  rules: Array<{ weekday: number; startTime: string; endTime: string }>,
) =>
  request<ScheduleRule[]>(
    `/companies/${companyId}/employees/${employeeId}/schedule`,
    { method: 'PUT', body: JSON.stringify({ rules }) },
  );

export const getScheduleExceptions = (
  companyId: string,
  employeeId: string,
) =>
  request<ScheduleException[]>(
    `/companies/${companyId}/employees/${employeeId}/schedule/exceptions`,
  );

export const createScheduleException = (
  companyId: string,
  employeeId: string,
  input: {
    date: string;
    type: ScheduleExceptionType;
    startTime?: string;
    endTime?: string;
  },
) =>
  request<ScheduleException>(
    `/companies/${companyId}/employees/${employeeId}/schedule/exceptions`,
    { method: 'POST', body: JSON.stringify(input) },
  );

export const deleteScheduleException = (
  companyId: string,
  employeeId: string,
  exceptionId: string,
) =>
  request<void>(
    `/companies/${companyId}/employees/${employeeId}/schedule/exceptions/${exceptionId}`,
    { method: 'DELETE' },
  );

export const getAppointments = (
  companyId: string,
  filters: {
    from?: string;
    to?: string;
    status?: AppointmentStatus;
    employeeId?: string;
    serviceId?: string;
    customerId?: string;
    source?: 'TELEGRAM' | 'DASHBOARD';
    search?: string;
    order?: 'asc' | 'desc';
    cursor?: string;
    limit?: number;
  } = {},
) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const query = params.size ? `?${params}` : '';
  return request<CursorPage<Appointment>>(`/companies/${companyId}/appointments${query}`);
};

export const createAppointment = (
  companyId: string,
  input: {
    customerId?: string;
    customer?: { firstName: string; lastName?: string; phone?: string };
    employeeId: string;
    serviceId: string;
    startsAt: string;
    notes?: string;
  },
  idempotencyKey: string,
) =>
  request<Appointment>(`/companies/${companyId}/appointments`, {
    method: 'POST',
    headers: { 'idempotency-key': idempotencyKey },
    body: JSON.stringify(input),
  });

export const rescheduleAppointment = (
  companyId: string,
  appointmentId: string,
  input: { startsAt: string; employeeId?: string; serviceId?: string; notes?: string },
) =>
  request<Appointment>(
    `/companies/${companyId}/appointments/${appointmentId}/reschedule`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );

export const updateAppointmentStatus = (
  companyId: string,
  appointmentId: string,
  status: AppointmentStatus,
  cancellationReason?: string,
) =>
  request<Appointment>(
    `/companies/${companyId}/appointments/${appointmentId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, cancellationReason }),
    },
  );

export const updateDepositStatus = (
  companyId: string,
  appointmentId: string,
  status: 'PAID' | 'WAIVED',
) =>
  request<Appointment>(
    `/companies/${companyId}/appointments/${appointmentId}/deposit`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
  );

export const getBot = (companyId: string) =>
  request<TelegramBot | null>(`/companies/${companyId}/bots`);

export const connectBot = (companyId: string, token: string) =>
  request<TelegramBot>(`/companies/${companyId}/bots/connect`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

export const activateBot = (companyId: string, botId: string) =>
  request<TelegramBot>(`/companies/${companyId}/bots/${botId}/activate`, {
    method: 'POST',
  });

export const disableBot = (companyId: string, botId: string) =>
  request<TelegramBot>(`/companies/${companyId}/bots/${botId}/disable`, {
    method: 'POST',
  });

export const getDashboard = (companyId: string, from?: string, to?: string) => {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return request<Dashboard>(
    `/companies/${companyId}/dashboard${params.size ? `?${params}` : ''}`,
  );
};

export const getCustomers = (companyId: string, search = '', cursor?: string) => {
  const params = new URLSearchParams({ limit: '25' });
  if (search) params.set('search', search);
  if (cursor) params.set('cursor', cursor);
  return request<CursorPage<Customer>>(`/companies/${companyId}/customers?${params}`);
};

export const getCustomer = (companyId: string, customerId: string) =>
  request<CustomerDetails>(`/companies/${companyId}/customers/${customerId}`);

export const getReviews = (companyId: string) =>
  request<ReviewDashboard>(`/companies/${companyId}/reviews`);

export const updateCustomer = (
  companyId: string,
  customerId: string,
  input: { firstName?: string; lastName?: string | null; phone?: string | null; notes?: string | null },
) => request<Customer>(`/companies/${companyId}/customers/${customerId}`, {
  method: 'PATCH', body: JSON.stringify(input),
});

export const setCustomerBlacklist = (companyId: string, customerId: string, blacklisted: boolean) =>
  request<Customer>(`/companies/${companyId}/customers/${customerId}/blacklist`, {
    method: 'POST', body: JSON.stringify({ blacklisted }),
  });

export const anonymizeCustomer = (companyId: string, customerId: string) =>
  request<void>(`/companies/${companyId}/customers/${customerId}/personal-data`, { method: 'DELETE' });

export const getAvailability = (
  companyId: string,
  input: { employeeId: string; serviceId: string; date: string },
) => {
  const params = new URLSearchParams(input);
  return request<{
    date: string;
    timezone: string;
    durationMinutes: number;
    slots: Array<{ startsAt: string; endsAt: string }>;
  }>(`/companies/${companyId}/availability?${params}`);
};

export const getMembers = (companyId: string, cursor?: string) => {
  const params = new URLSearchParams({ limit: '50' });
  if (cursor) params.set('cursor', cursor);
  return request<CursorPage<CompanyMember>>(`/companies/${companyId}/members?${params}`);
};

export const addMember = (
  companyId: string,
  input: { email: string; role: Company['role']; employeeId?: string | null },
) => request<CompanyMember>(`/companies/${companyId}/members`, { method: 'POST', body: JSON.stringify(input) });

export const updateMember = (
  companyId: string,
  memberId: string,
  input: { role?: Company['role']; employeeId?: string | null },
) => request<CompanyMember>(`/companies/${companyId}/members/${memberId}`, { method: 'PATCH', body: JSON.stringify(input) });

export const deleteMember = (companyId: string, memberId: string) =>
  request<void>(`/companies/${companyId}/members/${memberId}`, { method: 'DELETE' });

export const updateCompany = (
  companyId: string,
  input: Partial<Pick<Company,
    | 'name' | 'description' | 'phone' | 'email' | 'address' | 'timezone'
    | 'currency' | 'language' | 'minBookingNoticeMinutes' | 'maxBookingHorizonDays'
    | 'slotStepMinutes' | 'cancellationNoticeMinutes' | 'allowAnyEmployee' | 'rebookingDelayDays'>>,
) => request<Company>(`/companies/${companyId}`, { method: 'PATCH', body: JSON.stringify(input) });

export const getEntitlements = (companyId: string) =>
  request<Entitlements>(`/companies/${companyId}/billing`);

export const getPayments = (companyId: string, cursor?: string) => {
  const params = new URLSearchParams({ limit: '25' });
  if (cursor) params.set('cursor', cursor);
  return request<CursorPage<Payment>>(`/companies/${companyId}/billing/payments?${params}`);
};

export const createCheckout = (companyId: string, plan: 'STARTER' | 'PRO') =>
  request<{ confirmationUrl: string }>(`/companies/${companyId}/billing/checkout`, {
    method: 'POST',
    headers: { 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify({ plan }),
  });

export const syncPayment = (companyId: string, paymentId: string) =>
  request<Payment | null>(`/companies/${companyId}/billing/payments/${paymentId}/sync`, { method: 'POST' });

export const getAuditLogs = (companyId: string, cursor?: string) => {
  const params = new URLSearchParams({ limit: '25' });
  if (cursor) params.set('cursor', cursor);
  return request<CursorPage<AuditLog>>(`/companies/${companyId}/audit-logs?${params}`);
};
