import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

// Staff invitation emails are sent through Resend (transactional email service).
// Auth emails (verify email, password reset) still go through Supabase — they
// have access to the secure token material and we don't.
//
// To enable: set RESEND_API_KEY and EMAIL_FROM in apps/backend/.env.
// Without them, sending is skipped and a warning is logged — the invitation
// record is still created and the accept-invite link is logged so you can
// test the flow without an email account in development.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.from = this.config.get<string>('EMAIL_FROM', 'MyWAppStore <noreply@example.com>');

    if (apiKey && apiKey !== 're_your_api_key_here') {
      this.resend = new Resend(apiKey);
    } else {
      this.resend = null;
      this.logger.warn(
        'RESEND_API_KEY not configured — email sending disabled. ' +
        'Invite links will be logged to console for development use.',
      );
    }
  }

  async sendStaffInvitation(opts: {
    to: string;
    storeName: string;
    inviterName: string;
    acceptUrl: string;
    expiresInHours: number;
  }): Promise<void> {
    const { to, storeName, inviterName, acceptUrl, expiresInHours } = opts;

    // Always log in non-production for easy local testing
    if (this.config.get('NODE_ENV') !== 'production') {
      this.logger.debug(`Staff invite link for ${to}: ${acceptUrl}`);
    }

    if (!this.resend) return;

    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: `You've been invited to join ${storeName} on MyWAppStore`,
        html: staffInviteHtml({ storeName, inviterName, acceptUrl, expiresInHours }),
      });
      this.logger.log(`Staff invitation sent to ${to}`);
    } catch (error) {
      // Don't fail the invitation creation if email fails — the link can be
      // resent separately. Log the error so it's visible in monitoring.
      this.logger.error(`Failed to send invitation email to ${to}`, error);
    }
  }
}

function staffInviteHtml(opts: {
  storeName: string;
  inviterName: string;
  acceptUrl: string;
  expiresInHours: number;
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;padding:40px;border:1px solid #e5e7eb">
        <tr><td>
          <div style="width:48px;height:48px;background:#16a34a;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:24px">
            <span style="color:#fff;font-size:24px">🏪</span>
          </div>
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">You&apos;ve been invited</h1>
          <p style="margin:0 0 24px;color:#6b7280;font-size:15px">
            <strong style="color:#111827">${opts.inviterName}</strong> has invited you to join
            <strong style="color:#111827">${opts.storeName}</strong> as a staff member on MyWAppStore.
          </p>
          <a href="${opts.acceptUrl}"
             style="display:block;text-align:center;background:#16a34a;color:#fff;font-weight:600;font-size:15px;padding:14px 24px;border-radius:10px;text-decoration:none;margin-bottom:24px">
            Accept invitation
          </a>
          <p style="margin:0;color:#9ca3af;font-size:13px;text-align:center">
            This link expires in ${opts.expiresInHours} hours. If you weren&apos;t expecting this email, you can ignore it.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
