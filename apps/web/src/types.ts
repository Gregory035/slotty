export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  emailVerified: boolean;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface Company {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  language: string;
  logoUrl: string | null;
  role: 'OWNER' | 'ADMIN' | 'EMPLOYEE';
  subscriptionPlan: 'TRIAL' | 'STARTER' | 'PRO' | null;
  subscriptionStatus:
    | 'TRIALING'
    | 'ACTIVE'
    | 'PAST_DUE'
    | 'CANCELLED'
    | 'EXPIRED'
    | null;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string;
  category: string | null;
  photoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeService {
  id: string;
  name: string;
  durationMinutes: number;
  price: string;
}

export interface Employee {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
  description: string | null;
  color: string;
  isActive: boolean;
  services: EmployeeService[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleRule {
  id: string;
  companyId: string;
  employeeId: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

export type ScheduleExceptionType =
  | 'DAY_OFF'
  | 'CUSTOM_HOURS'
  | 'VACATION'
  | 'SICK_LEAVE';

export interface ScheduleException {
  id: string;
  companyId: string;
  employeeId: string;
  date: string;
  type: ScheduleExceptionType;
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED_BY_CUSTOMER'
  | 'CANCELLED_BY_COMPANY'
  | 'NO_SHOW';

export interface Appointment {
  id: string;
  companyId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  source: 'TELEGRAM' | 'DASHBOARD';
  price: string;
  notes: string | null;
  cancellationReason: string | null;
  customer: {
    id: string;
    telegramId: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
    phone: string | null;
  };
  employee: {
    id: string;
    firstName: string;
    lastName: string | null;
  };
  service: {
    id: string;
    name: string;
    durationMinutes: number;
  };
  timezone: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface TelegramBot {
  id: string;
  companyId: string;
  telegramBotId: string;
  username: string;
  status: 'ACTIVE' | 'DISABLED' | 'ERROR';
  webhookConfigured: boolean;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export type Section =
  | 'overview'
  | 'appointments'
  | 'services'
  | 'employees'
  | 'bot';
