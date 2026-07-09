-- New indexes added in Phase 6 (Performance Optimization)
-- These are additive — no data changes, purely structural additions.
-- Use CREATE INDEX CONCURRENTLY in production to avoid table locks on busy tables.
-- NOTE: CONCURRENTLY cannot run inside a transaction; run these manually if
-- the table has significant traffic at migration time.

-- Category storefront query: WHERE tenant_id = ? AND is_active = true
CREATE INDEX IF NOT EXISTS "categories_tenant_id_is_active_idx"
  ON "categories"("tenant_id", "is_active");

-- Order restaurant/fulfillment queue: WHERE tenant_id = ? AND fulfillment_type = ? AND status = ?
CREATE INDEX IF NOT EXISTS "orders_tenant_id_fulfillment_type_status_idx"
  ON "orders"("tenant_id", "fulfillment_type", "status");

-- Staff invitations pending list: WHERE tenant_id = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
CREATE INDEX IF NOT EXISTS "staff_invitations_pending_idx"
  ON "staff_invitations"("tenant_id", "accepted_at", "revoked_at", "expires_at");
