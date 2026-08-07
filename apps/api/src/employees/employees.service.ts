import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Employee, Prisma, Service } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ServicesService } from '../services/services.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

const servicesInclude = {
  services: {
    where: { service: { deletedAt: null } },
    include: { service: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.EmployeeInclude;

type EmployeeWithServices = Employee & {
  services: Array<{ service: Service }>;
};

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
  ) {}

  async create(
    companyId: string,
    input: CreateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.prisma.employee.create({
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
  ): Promise<EmployeeResponseDto> {
    await this.requireEmployee(companyId, employeeId);

    const employee = await this.prisma.employee.update({
      where: { id: employeeId },
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

    return this.toResponse(employee);
  }

  async softDelete(companyId: string, employeeId: string): Promise<void> {
    const result = await this.prisma.employee.updateMany({
      where: { id: employeeId, companyId, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    });

    if (result.count !== 1) {
      throw new NotFoundException('Employee not found');
    }
  }

  async assignService(
    companyId: string,
    employeeId: string,
    serviceId: string,
  ): Promise<EmployeeResponseDto> {
    await Promise.all([
      this.requireEmployee(companyId, employeeId),
      this.services.requireService(companyId, serviceId),
    ]);

    await this.prisma.employeeService.upsert({
      where: { employeeId_serviceId: { employeeId, serviceId } },
      update: { companyId },
      create: { companyId, employeeId, serviceId },
    });

    return this.findOne(companyId, employeeId);
  }

  async unassignService(
    companyId: string,
    employeeId: string,
    serviceId: string,
  ): Promise<EmployeeResponseDto> {
    await this.requireEmployee(companyId, employeeId);
    await this.prisma.employeeService.deleteMany({
      where: { companyId, employeeId, serviceId },
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
      services: employee.services.map(({ service }) => ({
        id: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        price: service.price.toFixed(2),
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
