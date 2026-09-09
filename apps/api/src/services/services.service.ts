import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Service } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServiceResponseDto } from './dto/service-response.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { EntitlementsService } from '../billing/entitlements.service';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async create(
    companyId: string,
    input: CreateServiceDto,
    actorId?: string,
  ): Promise<ServiceResponseDto> {
    await this.entitlements.assertCanCreateService(companyId);
    const service = await this.prisma.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: {
          companyId,
          name: this.requireName(input.name),
          description: this.optionalTrimmed(input.description),
          durationMinutes: input.durationMinutes,
          price: new Prisma.Decimal(input.price),
          category: this.optionalTrimmed(input.category),
          photoUrl: input.photoUrl,
          isActive: input.isActive ?? true,
          depositPercent: input.depositPercent ?? 0,
          depositFixedAmount: input.depositFixedAmount === undefined ? null : new Prisma.Decimal(input.depositFixedAmount),
        },
      });
      if (actorId) await tx.auditLog.create({ data: {
        companyId, actorId, action: 'service.created', entityType: 'Service', entityId: created.id,
      } });
      return created;
    });

    return this.toResponse(service);
  }

  async findAll(companyId: string): Promise<ServiceResponseDto[]> {
    const services = await this.prisma.service.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });

    return services.map((service) => this.toResponse(service));
  }

  async findOne(companyId: string, serviceId: string): Promise<ServiceResponseDto> {
    return this.toResponse(await this.requireService(companyId, serviceId));
  }

  async update(
    companyId: string,
    serviceId: string,
    input: UpdateServiceDto,
    actorId?: string,
  ): Promise<ServiceResponseDto> {
    await this.requireService(companyId, serviceId);

    const service = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.service.update({
        where: { id_companyId: { id: serviceId, companyId } },
        data: {
        ...(input.name !== undefined
          ? { name: this.requireName(input.name) }
          : {}),
        ...(input.description !== undefined
          ? { description: this.optionalTrimmed(input.description) }
          : {}),
        ...(input.durationMinutes !== undefined
          ? { durationMinutes: input.durationMinutes }
          : {}),
        ...(input.price !== undefined
          ? { price: new Prisma.Decimal(input.price) }
          : {}),
        ...(input.category !== undefined
          ? { category: this.optionalTrimmed(input.category) }
          : {}),
        ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.depositPercent !== undefined ? { depositPercent: input.depositPercent } : {}),
        ...(input.depositFixedAmount !== undefined ? { depositFixedAmount: new Prisma.Decimal(input.depositFixedAmount) } : {}),
        },
      });
      if (actorId) await tx.auditLog.create({ data: {
        companyId, actorId, action: 'service.updated', entityType: 'Service', entityId: serviceId,
        metadata: { fields: Object.keys(input) },
      } });
      return updated;
    });

    return this.toResponse(service);
  }

  async softDelete(companyId: string, serviceId: string, actorId?: string): Promise<void> {
    const result = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.service.updateMany({
        where: { id: serviceId, companyId, deletedAt: null },
        data: { deletedAt: new Date(), isActive: false },
      });
      if (changed.count === 1 && actorId) await tx.auditLog.create({ data: {
        companyId, actorId, action: 'service.deleted', entityType: 'Service', entityId: serviceId,
      } });
      return changed;
    });

    if (result.count !== 1) {
      throw new NotFoundException('Service not found');
    }
  }

  async requireService(companyId: string, serviceId: string): Promise<Service> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, companyId, deletedAt: null },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  private toResponse(service: Service): ServiceResponseDto {
    return {
      id: service.id,
      companyId: service.companyId,
      name: service.name,
      description: service.description,
      durationMinutes: service.durationMinutes,
      price: service.price.toFixed(2),
      category: service.category,
      photoUrl: service.photoUrl,
      isActive: service.isActive,
      depositPercent: service.depositPercent,
      depositFixedAmount: service.depositFixedAmount?.toFixed(2) ?? null,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }

  private requireName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Service name cannot be empty');
    }
    return trimmed;
  }

  private optionalTrimmed(value?: string): string | undefined {
    return value === undefined ? undefined : value.trim();
  }
}
