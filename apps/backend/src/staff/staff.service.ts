import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { PlanEnforcementService } from '../billing/plan-enforcement.service';
import { InviteStaffDto, AcceptInviteDto } from './dto/staff.dto';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// How long an invitation link stays valid
const INVITE_EXPIRES_HOURS = 72;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);
  private readonly supabaseAdmin;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly planEnforcement: PlanEnforcementService,
  ) {
    this.supabaseAdmin = createClient(
      this.config.getOrThrow('NEXT_PUBLIC_SUPABASE_URL'),
      this.config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  // ── LIST staff ─────────────────────────────────────────────────────────────
  async listStaff(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId, role: { in: ['STAFF', 'OWNER'] } },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const pendingInvitations = await this.prisma.staffInvitation.findMany({
      where: {
        tenantId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { users, pendingInvitations };
  }

  // ── INVITE ─────────────────────────────────────────────────────────────────
  async invite(tenantId: string, inviterId: string, dto: InviteStaffDto) {
    // Check plan limits first — free plan has no staff slots
    await this.planEnforcement.assertCanAddStaff(tenantId);

    // Don't invite someone who's already a user of this tenant
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email },
      select: { id: true, isActive: true },
    });

    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('This email address is already a member of your store.');
      }
      throw new ConflictException('This account has been deactivated. Re-enable it instead of inviting again.');
    }

    // Revoke any pending invitation for this email before issuing a new one
    await this.prisma.staffInvitation.updateMany({
      where: { tenantId, email: dto.email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Generate a token — only the hash is stored, the raw token goes in the
    // invite link, same approach as refresh token rotation
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = sha256(rawToken);

    const [invitation, inviter, tenant] = await Promise.all([
      this.prisma.staffInvitation.create({
        data: {
          tenantId,
          email: dto.email,
          role: dto.role,
          tokenHash,
          invitedById: inviterId,
          expiresAt: new Date(Date.now() + INVITE_EXPIRES_HOURS * 3_600_000),
        },
      }),
      this.prisma.user.findUnique({
        where: { id: inviterId },
        select: { fullName: true, email: true },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
    ]);

    const acceptUrl = `${this.config.get('FRONTEND_URL')}/staff/accept-invite?token=${rawToken}`;

    await this.email.sendStaffInvitation({
      to: dto.email,
      storeName: tenant!.name,
      inviterName: inviter?.fullName ?? inviter?.email ?? 'The store owner',
      acceptUrl,
      expiresInHours: INVITE_EXPIRES_HOURS,
    });

    this.logger.log(`Staff invitation sent: ${dto.email} → tenant ${tenantId}`);

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
  }

  // ── ACCEPT invitation ──────────────────────────────────────────────────────
  // Called from the public /staff/accept-invite page — no auth guard.
  async acceptInvite(dto: AcceptInviteDto) {
    const tokenHash = sha256(dto.token);

    const invitation = await this.prisma.staffInvitation.findUnique({
      where: { tokenHash },
      include: { tenant: { select: { id: true, name: true, slug: true, plan: true } } },
    });

    if (!invitation || invitation.revokedAt || invitation.acceptedAt) {
      throw new BadRequestException('This invitation link is invalid or has already been used.');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('This invitation link has expired. Ask the store owner to send a new one.');
    }

    // Check nobody already accepted another invite and took this email on this tenant
    const alreadyExists = await this.prisma.user.findFirst({
      where: { tenantId: invitation.tenantId, email: invitation.email },
    });

    if (alreadyExists) {
      throw new ConflictException('An account already exists for this email on this store.');
    }

    // Create the Supabase Auth user (handles password hashing)
    const { data: authData, error: authError } = await this.supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      password: dto.password,
      email_confirm: true, // already verified through the invite — trust the email
    });

    if (authError || !authData?.user) {
      this.logger.error('Failed to create Supabase auth user for staff invite', authError);
      throw new BadRequestException(authError?.message ?? 'Failed to create account. Please try again.');
    }

    // Create the Prisma user and mark the invitation accepted — transactional
    const user = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newUser = await tx.user.create({
        data: {
          authId: authData.user.id,
          tenantId: invitation.tenantId,
          email: invitation.email,
          fullName: dto.fullName,
          role: invitation.role,
          emailVerifiedAt: new Date(), // trusted via invite link
        },
        select: { id: true, email: true, fullName: true, role: true },
      });

      await tx.staffInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return newUser;
    });

    this.logger.log(`Staff invite accepted: ${user.email} joined tenant ${invitation.tenantId}`);

    return {
      message: `Welcome to ${invitation.tenant.name}! You can now sign in.`,
      email: user.email,
    };
  }

  // ── DEACTIVATE staff member ────────────────────────────────────────────────
  async deactivate(tenantId: string, targetUserId: string, requesterId: string) {
    if (targetUserId === requesterId) {
      throw new ForbiddenException('You cannot deactivate your own account.');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
      select: { id: true, role: true, email: true, isActive: true, authId: true },
    });

    if (!target) throw new NotFoundException('Staff member not found.');
    if (target.role === 'OWNER') throw new ForbiddenException('Cannot deactivate the store owner.');
    if (!target.isActive) throw new ConflictException('This account is already deactivated.');

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({ where: { id: targetUserId }, data: { isActive: false } });
      // Immediately revoke all active sessions so they're logged out everywhere
      await tx.refreshToken.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    // Disable in Supabase Auth too so they can't get a fresh token
    await this.supabaseAdmin.auth.admin.updateUserById(target.authId, { ban_duration: 'none' }).catch(() => {});

    this.logger.log(`Staff member deactivated: ${target.email} [tenant ${tenantId}]`);
    return { message: `${target.email} has been deactivated and signed out.` };
  }

  // ── REACTIVATE ─────────────────────────────────────────────────────────────
  async reactivate(tenantId: string, targetUserId: string) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
      select: { id: true, email: true, isActive: true, authId: true },
    });

    if (!target) throw new NotFoundException('Staff member not found.');
    if (target.isActive) throw new ConflictException('This account is already active.');

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: true },
    });

    await this.supabaseAdmin.auth.admin.updateUserById(target.authId, { ban_duration: '0' }).catch(() => {});

    return { message: `${target.email} has been reactivated.` };
  }

  // ── REVOKE pending invitation ──────────────────────────────────────────────
  async revokeInvitation(tenantId: string, invitationId: string) {
    const result = await this.prisma.staffInvitation.updateMany({
      where: { id: invitationId, tenantId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) throw new NotFoundException('Invitation not found or already resolved.');
    return { message: 'Invitation revoked.' };
  }
}
