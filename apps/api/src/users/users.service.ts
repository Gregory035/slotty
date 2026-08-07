import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

interface CreateUserInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({ data: input });
  }
}
