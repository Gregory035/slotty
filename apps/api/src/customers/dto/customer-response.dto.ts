import { AppointmentStatus } from '@prisma/client';

export interface CustomerStatisticsDto {
  appointments: number;
  completed: number;
  cancelled: number;
  noShow: number;
  revenue: string;
  averageRating: number | null;
  reviewsCount: number;
}

export interface CustomerResponseDto {
  id: string;
  companyId: string;
  telegramId: string | null;
  username: string | null;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  notes: string | null;
  isBlacklisted: boolean;
  anonymizedAt: Date | null;
  statistics: CustomerStatisticsDto;
  createdAt: Date;
  lastActivityAt: Date;
  updatedAt: Date;
}

export interface CustomerAppointmentDto {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  price: string;
  service: { id: string; name: string };
  employee: { id: string; firstName: string; lastName: string | null };
}

export interface CustomerDetailsDto extends CustomerResponseDto {
  upcomingAppointments: CustomerAppointmentDto[];
  recentAppointments: CustomerAppointmentDto[];
  favoriteService: { id: string; name: string; count: number } | null;
  favoriteEmployee: { id: string; name: string; count: number } | null;
}
