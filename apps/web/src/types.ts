export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  emailVerified: boolean;
}

export interface Session {
  accessToken: string;
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
  employeeId: string | null;
  minBookingNoticeMinutes: number;
  maxBookingHorizonDays: number;
  slotStepMinutes: number;
  cancellationNoticeMinutes: number;
  allowAnyEmployee: boolean;
  rebookingDelayDays: number;
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
  depositPercent: number;
  depositFixedAmount: string | null;
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
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
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
  depositAmount: string;
  depositStatus: 'NOT_REQUIRED' | 'PENDING' | 'PAID' | 'WAIVED';
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
  review: {
    rating: number;
    comment: string | null;
    createdAt: string;
  } | null;
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

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface Dashboard {
  period: { from: string; to: string; timezone: string };
  currency: string;
  todayAppointments: number;
  cancelledAppointments: number;
  expectedRevenue: string;
  actualRevenue: string;
  activeServices: number;
  activeEmployees: number;
  occupancy: { bookedMinutes: number; capacityMinutes: number; percent: number };
  bot: { id: string; username: string; status: TelegramBot['status']; errorMessage: string | null } | null;
  upcomingAppointments: Array<{
    id: string;
    startsAt: string;
    status: AppointmentStatus;
    customerName: string;
    employeeName: string;
    serviceName: string;
  }>;
  setupChecklist: Array<{ id: string; label: string; done: boolean; section: Section }>;
  waitlistCount: number;
  analytics: {
    summary: {
      appointments: number;
      completed: number;
      cancelled: number;
      noShows: number;
      actualRevenue: string;
      averageCheck: string;
      cancellationRate: number;
      noShowRate: number;
      newCustomers: number;
      returningCustomers: number;
    };
    daily: Array<{ date: string; appointments: number; completed: number; revenue: number; cancelled: number }>;
    sources: { telegram: number; dashboard: number };
    funnel: { started: number; serviceSelected: number; dateSelected: number; timeSelected: number; booked: number; conversion: number };
    services: Array<{ id: string; name: string; appointments: number; completed: number; revenue: number }>;
    employees: Array<{ id: string; name: string; appointments: number; completed: number; revenue: number }>;
  };
}

export interface Customer {
  id: string;
  companyId: string;
  telegramId: string | null;
  username: string | null;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  notes: string | null;
  isBlacklisted: boolean;
  anonymizedAt: string | null;
  statistics: {
    appointments: number;
    completed: number;
    cancelled: number;
    noShow: number;
    revenue: string;
    averageRating: number | null;
    reviewsCount: number;
  };
  createdAt: string;
  lastActivityAt: string;
  updatedAt: string;
}

export interface CustomerAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  price: string;
  service: { id: string; name: string };
  employee: { id: string; firstName: string; lastName: string | null };
}

export interface CustomerDetails extends Customer {
  upcomingAppointments: CustomerAppointment[];
  recentAppointments: CustomerAppointment[];
  favoriteService: { id: string; name: string; count: number } | null;
  favoriteEmployee: { id: string; name: string; count: number } | null;
}

export interface ReviewDashboard {
  summary: { average: number; count: number };
  byEmployee: Array<{ id: string; name: string; average: number; count: number }>;
  byService: Array<{ id: string; name: string; average: number; count: number }>;
  items: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    appointmentId: string;
    customer: { id: string; firstName: string; lastName: string | null; username: string | null };
    employee: { id: string; name: string };
    service: { id: string; name: string };
  }>;
}

export interface CompanyMember {
  id: string;
  companyId: string;
  userId: string;
  employeeId: string | null;
  role: Company['role'];
  email: string;
  firstName: string;
  lastName: string | null;
  createdAt: string;
}

export interface Entitlements {
  plan: 'TRIAL' | 'STARTER' | 'PRO';
  status: NonNullable<Company['subscriptionStatus']>;
  active: boolean;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  graceEndsAt: string | null;
  limits: {
    employees: number;
    services: number;
    monthlyAppointments: number;
    bots: number;
    analytics: boolean;
    customNotifications: boolean;
  };
  usage: { employees: number; services: number; monthlyAppointments: number; bots: number };
}

export interface Payment {
  id: string;
  amount: string;
  currency: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  planSnapshot: 'TRIAL' | 'STARTER' | 'PRO';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  actor: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'> | null;
  createdAt: string;
}

export type Section =
  | 'dashboard'
  | 'analytics'
  | 'calendar'
  | 'appointments'
  | 'customers'
  | 'reviews'
  | 'services'
  | 'employees'
  | 'schedule'
  | 'bot'
  | 'members'
  | 'billing'
  | 'settings'
  | 'audit';
