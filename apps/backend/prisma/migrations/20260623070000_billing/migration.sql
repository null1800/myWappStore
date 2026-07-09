-- CreateTable: subscriptions (one row per tenant, tracks current plan period)
CREATE TABLE "subscriptions" (
    "id"                    UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"             UUID NOT NULL,
    "plan"                  TEXT NOT NULL,
    "status"                TEXT NOT NULL,
    "current_period_start"  TIMESTAMP(3) NOT NULL,
    "current_period_end"    TIMESTAMP(3) NOT NULL,
    "trial_ends_at"         TIMESTAMP(3),
    "cancelled_at"          TIMESTAMP(3),
    "paystack_customer_id"  TEXT,
    "paystack_sub_code"     TEXT,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscriptions_tenant_id_key" ON "subscriptions"("tenant_id");
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "subscriptions"("status", "current_period_end");

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing tenant gets a free-plan subscription so the
-- plan enforcement code always finds a row (no null-check needed at runtime).
INSERT INTO "subscriptions" (
  "tenant_id", "plan", "status",
  "current_period_start", "current_period_end", "updated_at"
)
SELECT
  id,
  plan,
  'active',
  NOW(),
  -- Free plan never expires — use a far-future date as a sentinel
  NOW() + INTERVAL '100 years',
  NOW()
FROM "tenants";

-- CreateTable: payment_transactions (immutable audit log)
CREATE TABLE "payment_transactions" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"    UUID NOT NULL,
    "provider"     TEXT NOT NULL,
    "provider_ref" TEXT,
    "type"         TEXT NOT NULL,
    "plan"         TEXT,
    "amount_kobo"  INTEGER NOT NULL,
    "currency"     TEXT NOT NULL DEFAULT 'ZMW',
    "status"       TEXT NOT NULL,
    "metadata"     JSONB,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_transactions_tenant_id_created_at_idx" ON "payment_transactions"("tenant_id", "created_at");
CREATE INDEX "payment_transactions_provider_ref_idx" ON "payment_transactions"("provider_ref");

ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
