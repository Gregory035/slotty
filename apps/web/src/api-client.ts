import type { Session } from './types';

import { userErrorMessage } from './user-errors';

export const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
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

export async function responseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    const message = Array.isArray(body.message)
      ? body.message.join('. ')
      : body.message;
    return new ApiError(userErrorMessage(message || '', response.status, response.url), response.status);
  } catch {
    return new ApiError('Не удалось выполнить запрос', response.status);
  }
}

export async function responseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.text();
  return (body ? JSON.parse(body) : null) as T;
}

export async function fetchResponse(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new ApiError('Не удалось связаться с сервером. Проверьте интернет и повторите попытку', 0);
  }
}

export async function publicRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetchResponse(`${apiUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) throw await responseError(response);
  return responseBody<T>(response);
}

export async function miniAppRequest<T>(
  companyId: string,
  path: 'session' | 'availability' | 'book' | 'book-visit' | 'event' | 'appointments' | 'appointments/cancel' | 'appointments/reschedule' | 'appointments/review',
  input: unknown,
): Promise<T> {
  const response = await fetchResponse(`${apiUrl}/telegram/miniapp/${companyId}/${path}`, {
    signal: AbortSignal.timeout(20_000),
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await responseError(response);
  return responseBody<T>(response);
}

export async function refreshSession(): Promise<Session> {
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

export async function request<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const session = readSession();
  if (!session) throw new ApiError('Войдите в аккаунт', 401);
  const response = await fetchResponse(`${apiUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
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
