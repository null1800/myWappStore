-- AlterTable: add atomic per-tenant order counter
ALTER TABLE "tenants" ADD COLUMN "order_sequence" INTEGER NOT NULL DEFAULT 0;

-- Backfill: seed each tenant's counter from its existing order count so that
-- future order numbers continue from the right point instead of colliding
-- with order numbers already issued under the old count()+1 scheme.
UPDATE "tenants" AS t
SET "order_sequence" = sub.cnt
FROM (
  SELECT "tenant_id", COUNT(*) AS cnt
  FROM "orders"
  GROUP BY "tenant_id"
) AS sub
WHERE t."id" = sub."tenant_id";

-- CreateTable: server-side record of issued refresh tokens (rotation + revocation)
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens"("user_id", "revoked_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
