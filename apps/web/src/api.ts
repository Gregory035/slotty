import type {
  Appointment,
  AppointmentStatus,
  Company,
  Employee,
  ScheduleException,
  ScheduleExceptionType,
  ScheduleRule,
  Service,
  Session,
  TelegramBot,
} from './types';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const sessionKey = 'telegram-business-session';
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
  if (typeof localStorage === 'undefined') return null;
  try {
    const value = localStorage.getItem(sessionKey);
    return value ? (JSON.parse(value) as Session) : null;
  } catch {
    localStorage.removeItem(sessionKey);
    return null;
  }
}

export function writeSession(session: Session | null): void {
  if (typeof localStorage === 'undefined') return;
  if (session) localStorage.setItem(sessionKey, JSON.stringify(session));
  else localStorage.removeItem(sessionKey);
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
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) throw await responseError(response);
  return responseBody<T>(response);
}

async function refreshSession(refreshToken: string): Promise<Session> {
  if (!refreshPromise) {
    refreshPromise = publicRequest<Session>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
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
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      authorization: `Bearer ${session.accessToken}`,
      ...options.headers,
    },
  });
  if (response.status === 401 && !retried) {
    try {
      await refreshSession(session.refreshToken);
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

export async function logout(): Promise<void> {
  const session = readSession();
  try {
    if (session) {
      await publicRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    }
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
  filters: { from?: string; to?: string; status?: AppointmentStatus } = {},
) => {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.status) params.set('status', filters.status);
  const query = params.size ? `?${params}` : '';
  return request<Appointment[]>(`/companies/${companyId}/appointments${query}`);
};

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
