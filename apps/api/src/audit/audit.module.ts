import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompaniesModule } from '../companies/companies.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({ imports: [AuthModule, CompaniesModule], controllers: [AuditController], providers: [AuditService] })
export class AuditModule {}
