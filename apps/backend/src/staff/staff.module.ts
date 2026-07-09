import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { EmailService } from './email.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [StaffController],
  providers: [StaffService, EmailService],
})
export class StaffModule {}
