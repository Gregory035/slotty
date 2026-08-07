import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Service } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServiceResponseDto } from './dto/service-response.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    companyId: string,
    input: CreateServiceDto,
  ): Promise<ServiceResponseDto> {
    const service = await this.prisma.service.create({
      data: {
        companyId,
        name: this.requireName(input.name),
        description: this.optionalTrimmed(input.description),
        durationMinutes: input.durationMinutes,
        price: new Prisma.Decimal(input.price),
        category: this.optionalTrimmed(input.category),
        photoUrl: input.photoUrl,
        isActive: input.isActive ?? true,
      },
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
  ): Promise<ServiceResponseDto> {
    await this.requireService(companyId, serviceId);

    const service = await this.prisma.service.update({
      where: { id: serviceId },
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
      },
    });

    return this.toResponse(service);
  }

  async softDelete(companyId: string, serviceId: string): Promise<void> {
    const result = await this.prisma.service.updateMany({
      where: { id: serviceId, companyId, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
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
