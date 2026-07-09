import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { InviteStaffDto, AcceptInviteDto } from './dto/staff.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Tenant, type TenantContext } from '../common/decorators/tenant.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  // ── GET /api/v1/staff ──────────────────────────────────────────────────────
  // List all staff users and pending invitations for this tenant
  @Get()
  @Roles('OWNER')
  listStaff(@Tenant() tenant: TenantContext) {
    return this.staffService.listStaff(tenant.id);
  }

  // ── POST /api/v1/staff/invite ──────────────────────────────────────────────
  @Post('invite')
  @Roles('OWNER')
  @HttpCode(HttpStatus.CREATED)
  invite(@Tenant() tenant: TenantContext, @Body() dto: InviteStaffDto) {
    return this.staffService.invite(tenant.id, tenant.userId, dto);
  }

  // ── DELETE /api/v1/staff/invitations/:id ──────────────────────────────────
  @Delete('invitations/:id')
  @Roles('OWNER')
  @HttpCode(HttpStatus.OK)
  revokeInvitation(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.staffService.revokeInvitation(tenant.id, id);
  }

  // ── DELETE /api/v1/staff/:userId ──────────────────────────────────────────
  // Deactivate a staff member (immediate session revocation)
  @Delete(':userId')
  @Roles('OWNER')
  @HttpCode(HttpStatus.OK)
  deactivate(
    @Tenant() tenant: TenantContext,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.staffService.deactivate(tenant.id, userId, tenant.userId);
  }

  // ── POST /api/v1/staff/:userId/reactivate ─────────────────────────────────
  @Post(':userId/reactivate')
  @Roles('OWNER')
  @HttpCode(HttpStatus.OK)
  reactivate(
    @Tenant() tenant: TenantContext,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.staffService.reactivate(tenant.id, userId);
  }

  // ── POST /api/v1/staff/accept-invite ──────────────────────────────────────
  // Public — no auth. Called by the invite acceptance page.
  @Public()
  @Post('accept-invite')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.staffService.acceptInvite(dto);
  }
}
