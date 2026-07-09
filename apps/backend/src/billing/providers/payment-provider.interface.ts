// All payment providers implement this interface.
// The billing service only knows about this interface — never about Paystack
// or any specific provider directly. Adding Mobile Money / MTN / Airtel means
// implementing this interface and registering via the factory, nothing else.
export interface InitiatePaymentResult {
  authorizationUrl: string; // redirect the user here
  reference: string;        // our internal reference to match the callback
  accessCode?: string;      // Paystack-specific; omit for other providers
}

export interface VerifyPaymentResult {
  success: boolean;
  reference: string;
  providerRef: string;       // provider's own transaction ID
  amountPaid: number;        // in smallest unit (tambala / kobo)
  currency: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;

  initiatePayment(opts: {
    amountTambala: number;
    currency: string;
    email: string;
    reference: string;         // our generated reference
    metadata?: Record<string, unknown>;
    callbackUrl: string;
  }): Promise<InitiatePaymentResult>;

  verifyPayment(reference: string): Promise<VerifyPaymentResult>;

  validateWebhook(rawBody: Buffer, signature: string): boolean;

  parseWebhookEvent(rawBody: Buffer): {
    event: string;
    reference?: string;
    data: Record<string, unknown>;
  };
}
