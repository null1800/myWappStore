import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type {
  PaymentProvider,
  InitiatePaymentResult,
  VerifyPaymentResult,
} from './payment-provider.interface';

// Paystack docs: https://paystack.com/docs/api
// All amounts are in kobo (NGN) or tambala (ZMW) — the smallest unit.
// Paystack supports ZMW natively for Zambia.
@Injectable()
export class PaystackProvider implements PaymentProvider {
  readonly name = 'paystack';
  private readonly logger = new Logger(PaystackProvider.name);
  private readonly secretKey: string | null;
  private readonly baseUrl = 'https://api.paystack.co';

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('PAYSTACK_SECRET_KEY');
    this.secretKey = key && key !== 'sk_test_your_key_here' ? key : null;

    if (!this.secretKey) {
      this.logger.warn(
        'PAYSTACK_SECRET_KEY not configured — payment initiation will be unavailable. ' +
        'Set it in apps/backend/.env to enable billing.',
      );
    }
  }

  get isConfigured(): boolean {
    return this.secretKey !== null;
  }

  async initiatePayment(opts: {
    amountTambala: number;
    currency: string;
    email: string;
    reference: string;
    metadata?: Record<string, unknown>;
    callbackUrl: string;
  }): Promise<InitiatePaymentResult> {
    if (!this.secretKey) {
      throw new Error('Paystack is not configured. Set PAYSTACK_SECRET_KEY in your environment.');
    }

    const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: opts.email,
        amount: opts.amountTambala,
        currency: opts.currency,
        reference: opts.reference,
        callback_url: opts.callbackUrl,
        metadata: opts.metadata ?? {},
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Paystack initiate failed: ${response.status} ${text}`);
      throw new Error(`Payment initiation failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      status: boolean;
      data: { authorization_url: string; reference: string; access_code: string };
    };

    if (!data.status) throw new Error('Paystack returned unsuccessful status');

    return {
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
      accessCode: data.data.access_code,
    };
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    if (!this.secretKey) throw new Error('Paystack not configured');

    const response = await fetch(
      `${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${this.secretKey}` } },
    );

    if (!response.ok) throw new Error(`Verify failed: ${response.statusText}`);

    const data = (await response.json()) as {
      status: boolean;
      data: {
        status: string;
        reference: string;
        id: number;
        amount: number;
        currency: string;
      };
    };

    return {
      success: data.data.status === 'success',
      reference: data.data.reference,
      providerRef: String(data.data.id),
      amountPaid: data.data.amount,
      currency: data.data.currency,
    };
  }

  // Webhook signature verification — Paystack signs with HMAC-SHA512.
  // Call this before processing ANY webhook event.
  validateWebhook(rawBody: Buffer, signature: string): boolean {
    if (!this.secretKey) return false;
    const computed = createHmac('sha512', this.secretKey)
      .update(rawBody)
      .digest('hex');
    return computed === signature;
  }

  parseWebhookEvent(rawBody: Buffer): {
    event: string;
    reference?: string;
    data: Record<string, unknown>;
  } {
    const payload = JSON.parse(rawBody.toString()) as {
      event: string;
      data: Record<string, unknown>;
    };

    return {
      event: payload.event,
      reference: payload.data?.reference as string | undefined,
      data: payload.data,
    };
  }
}
