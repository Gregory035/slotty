import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Employee, Prisma, Service } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ServicesService } from '../services/services.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AssignEmployeeServiceDto } from './dto/assign-service.dto';
import { EntitlementsService } from '../billing/entitlements.service';

const servicesInclude = {
  services: {
    where: { service: { deletedAt: null } },
    include: { service: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.EmployeeInclude;

type EmployeeWithServices = Employee & {
  services: Array<{
    service: Service;
    durationMinutes: number | null;
    price: Prisma.Decimal | null;
    bufferBeforeMinutes: number;
    bufferAfterMinutes: number;
  }>;
};

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async create(
    companyId: string,
    input: CreateEmployeeDto,
    actorId?: string,
  ): Promise<EmployeeResponseDto> {
    await this.entitlements.assertCanCreateEmployee(companyId);
    const employee = await this.prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          companyId,
          firstName: this.requireFirstName(input.firstName),
          lastName: this.optionalTrimmed(input.lastName),
          phone: this.optionalTrimmed(input.phone),
          email: input.email?.trim().toLowerCase(),
          photoUrl: input.photoUrl,
          description: this.optionalTrimmed(input.description),
          color: input.color?.toUpperCase() ?? '#4F46E5',
          isActive: input.isActive ?? true,
        },
        include: servicesInclude,
      });
      if (actorId) await tx.auditLog.create({ data: {
        companyId, actorId, action: 'employee.created', entityType: 'Employee', entityId: created.id,
      } });
      return created;
    });

    return this.toResponse(employee);
  }

  async findAll(companyId: string): Promise<EmployeeResponseDto[]> {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      include: servicesInclude,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });

    return employees.map((employee) => this.toResponse(employee));
  }

  async findOne(
    companyId: string,
    employeeId: string,
  ): Promise<EmployeeResponseDto> {
    return this.toResponse(await this.requireEmployee(companyId, employeeId));
  }

  async update(
    companyId: string,
    employeeId: string,
    input: UpdateEmployeeDto,
    actorId?: string,
  ): Promise<EmployeeResponseDto> {
    await this.requireEmployee(companyId, employeeId);

    const employee = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id_companyId: { id: employeeId, companyId } },
        data: {
        ...(input.firstName !== undefined
          ? { firstName: this.requireFirstName(input.firstName) }
          : {}),
        ...(input.lastName !== undefined
          ? { lastName: this.optionalTrimmed(input.lastName) }
          : {}),
        ...(input.phone !== undefined
          ? { phone: this.optionalTrimmed(input.phone) }
          : {}),
        ...(input.email !== undefined
          ? { email: input.email.trim().toLowerCase() }
          : {}),
        ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
        ...(input.description !== undefined
          ? { description: this.optionalTrimmed(input.description) }
          : {}),
        ...(input.color !== undefined ? { color: input.color.toUpperCase() } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        include: servicesInclude,
      });
      if (actorId) await tx.auditLog.create({ data: {
        companyId, actorId, action: 'employee.updated', entityType: 'Employee', entityId: employeeId,
        metadata: { fields: Object.keys(input) },
      } });
      return updated;
    });

    return this.toResponse(employee);
  }

  async softDelete(companyId: string, employeeId: string, actorId?: string): Promise<void> {
    const result = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.employee.updateMany({
        where: { id: employeeId, companyId, deletedAt: null },
        data: { deletedAt: new Date(), isActive: false },
      });
      if (changed.count === 1 && actorId) await tx.auditLog.create({ data: {
        companyId, actorId, action: 'employee.deleted', entityType: 'Employee', entityId: employeeId,
      } });
      return changed;
    });

    if (result.count !== 1) {
      throw new NotFoundException('Employee not found');
    }
  }

  async assignService(
    companyId: string,
    employeeId: string,
    serviceId: string,
    input: AssignEmployeeServiceDto = {},
    actorId?: string,
  ): Promise<EmployeeResponseDto> {
    await Promise.all([
      this.requireEmployee(companyId, employeeId),
      this.services.requireService(companyId, serviceId),
    ]);

    await this.prisma.$transaction(async (tx) => {
      await tx.employeeService.upsert({
        where: {
          companyId_employeeId_serviceId: { companyId, employeeId, serviceId },
        },
        update: {
          durationMinutes: input.durationMinutes ?? null,
          price: input.price !== undefined ? new Prisma.Decimal(input.price) : null,
          bufferBeforeMinutes: input.bufferBeforeMinutes ?? 0,
          bufferAfterMinutes: input.bufferAfterMinutes ?? 0,
        },
        create: {
          companyId,
          employeeId,
          serviceId,
          durationMinutes: input.durationMinutes,
          price: input.price !== undefined ? new Prisma.Decimal(input.price) : undefined,
          bufferBeforeMinutes: input.bufferBeforeMinutes ?? 0,
          bufferAfterMinutes: input.bufferAfterMinutes ?? 0,
        },
      });
      if (actorId) await tx.auditLog.create({ data: {
        companyId, actorId, action: 'employee.service_assigned', entityType: 'Employee', entityId: employeeId,
        metadata: { serviceId },
      } });
    });

    return this.findOne(companyId, employeeId);
  }

  async unassignService(
    companyId: string,
    employeeId: string,
    serviceId: string,
    actorId?: string,
  ): Promise<EmployeeResponseDto> {
    await this.requireEmployee(companyId, employeeId);
    await this.prisma.$transaction(async (tx) => {
      await tx.employeeService.deleteMany({ where: { companyId, employeeId, serviceId } });
      if (actorId) await tx.auditLog.create({ data: {
        companyId, actorId, action: 'employee.service_unassigned', entityType: 'Employee', entityId: employeeId,
        metadata: { serviceId },
      } });
    });

    return this.findOne(companyId, employeeId);
  }

  private async requireEmployee(
    companyId: string,
    employeeId: string,
  ): Promise<EmployeeWithServices> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      include: servicesInclude,
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  private toResponse(employee: EmployeeWithServices): EmployeeResponseDto {
    return {
      id: employee.id,
      companyId: employee.companyId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone,
      email: employee.email,
      photoUrl: employee.photoUrl,
      description: employee.description,
      color: employee.color,
      isActive: employee.isActive,
      services: employee.services.map((assignment) => ({
        id: assignment.service.id,
        name: assignment.service.name,
        durationMinutes:
          assignment.durationMinutes ?? assignment.service.durationMinutes,
        price: (assignment.price ?? assignment.service.price).toFixed(2),
        bufferBeforeMinutes: assignment.bufferBeforeMinutes,
        bufferAfterMinutes: assignment.bufferAfterMinutes,
      })),
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }

  private requireFirstName(firstName: string): string {
    const trimmed = firstName.trim();
    if (!trimmed) {
      throw new BadRequestException('Employee first name cannot be empty');
    }
    return trimmed;
  }

  private optionalTrimmed(value?: string): string | undefined {
    return value === undefined ? undefined : value.trim();
  }
}
