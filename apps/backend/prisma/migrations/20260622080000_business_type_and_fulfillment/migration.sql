-- AlterTable: tenants gain a business_type to drive workflow branching
ALTER TABLE "tenants" ADD COLUMN "business_type" TEXT NOT NULL DEFAULT 'GENERAL';

-- AlterTable: orders gain fulfillment metadata
ALTER TABLE "orders" ADD COLUMN "fulfillment_type" TEXT NOT NULL DEFAULT 'DELIVERY';
ALTER TABLE "orders" ADD COLUMN "scheduled_for"    TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "estimated_ready_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "table_number"     TEXT;

-- AlterEnum: add new values to OrderStatus
-- Postgres requires separate ALTER TYPE statements; cannot add multiple in one.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'QUOTE_SENT';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'BOOKED';
