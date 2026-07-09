-- ─────────────────────────────────────────────────────────────────────────────
-- MyWAppStore — Row Level Security Policies
-- Run this in Supabase SQL Editor AFTER running Prisma migrations
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠️  IMPORTANT — READ BEFORE RELYING ON THIS FILE FOR TENANT ISOLATION  ⚠️
--
-- DATABASE_URL/DIRECT_URL (used by Prisma/NestJS) connect via Supabase's
-- `postgres` pooler role, which OWNS these tables and therefore has the
-- BYPASSRLS attribute. Postgres skips RLS entirely for any role with that
-- attribute, regardless of what `auth.tenant_id()` would otherwise return.
--
-- CONCRETELY: every request that goes through the NestJS API (which is all
-- of them today — there is no direct Supabase client usage from the
-- frontend) bypasses every policy below. Tenant isolation for that traffic
-- is enforced entirely in application code (every service method filters by
-- tenantId, and every write also scopes its WHERE clause by tenantId via
-- updateMany/deleteMany — see products/categories/customers/orders
-- services). These policies are NOT a backstop for that path.
--
-- What these policies DO protect: any FUTURE direct access path that uses
-- Supabase's anon/authenticated keys instead of the service-role pooler
-- connection — e.g. if the frontend ever calls supabase-js directly, or a
-- Supabase Edge Function is added, or someone browses the Supabase Studio
-- table editor with a non-owner role. Worth keeping enabled for that reason,
-- just don't treat it as covering the API.
--
-- To get genuine DB-level enforcement for the API path itself would mean
-- connecting as a non-BYPASSRLS role and setting `request.jwt.claims` per
-- request/transaction (extra round-trip per query, and needs verifying
-- against Supabase's pooler in transaction-pooling mode) — a real
-- architecture change, not a config tweak. Flagging as a deliberate option
-- to consider, not doing it silently here.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Step 1: Enable RLS on all tenant-scoped tables ────────────────────────────
ALTER TABLE tenants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_invitations   ENABLE ROW LEVEL SECURITY;

-- ── Step 2: Helper function — extracts tenant_id from JWT claim ───────────────
-- The NestJS API sets tenant_id in the JWT. Supabase reads it here.
CREATE OR REPLACE FUNCTION auth.tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::uuid;
$$ LANGUAGE sql STABLE;

-- ── Step 3: Tenant table policies ────────────────────────────────────────────
-- Merchants can read their own tenant row
CREATE POLICY "tenant_read_own" ON tenants
  FOR SELECT USING (id = auth.tenant_id());

-- Only service role (server-side) can insert/update tenants
-- The NestJS API uses SUPABASE_SERVICE_ROLE_KEY for registration
CREATE POLICY "tenant_service_write" ON tenants
  FOR ALL USING (auth.role() = 'service_role');

-- ── Step 4: Users table policies ─────────────────────────────────────────────
CREATE POLICY "users_read_own_tenant" ON users
  FOR SELECT USING (tenant_id = auth.tenant_id());

CREATE POLICY "users_service_write" ON users
  FOR ALL USING (auth.role() = 'service_role');

-- ── Step 5: Categories policies ──────────────────────────────────────────────
-- Merchants read/write own categories
CREATE POLICY "categories_tenant_all" ON categories
  FOR ALL USING (tenant_id = auth.tenant_id());

-- Public read for active categories (storefront)
CREATE POLICY "categories_public_read" ON categories
  FOR SELECT USING (is_active = true);

-- ── Step 6: Products policies ─────────────────────────────────────────────────
-- Merchants manage own products
CREATE POLICY "products_tenant_all" ON products
  FOR ALL USING (tenant_id = auth.tenant_id());

-- Public read for active products (storefront — no auth required)
CREATE POLICY "products_public_read" ON products
  FOR SELECT USING (status = 'ACTIVE');

-- ── Step 6b: Product variants policies ────────────────────────────────────────
CREATE POLICY "product_variants_tenant_all" ON product_variants
  FOR ALL USING (tenant_id = auth.tenant_id());

-- Public read for active variants of active products (storefront)
CREATE POLICY "product_variants_public_read" ON product_variants
  FOR SELECT USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variants.product_id
      AND products.status = 'ACTIVE'
    )
  );

-- ── Step 7: Customers policies ────────────────────────────────────────────────
CREATE POLICY "customers_tenant_all" ON customers
  FOR ALL USING (tenant_id = auth.tenant_id());

-- ── Step 8: Orders policies ───────────────────────────────────────────────────
CREATE POLICY "orders_tenant_all" ON orders
  FOR ALL USING (tenant_id = auth.tenant_id());

-- Allow unauthenticated order creation (WhatsApp checkout)
-- The NestJS API validates and inserts via service role
CREATE POLICY "orders_service_insert" ON orders
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ── Step 9: Order items policies ─────────────────────────────────────────────
-- Order items are accessed via the order's tenant
CREATE POLICY "order_items_tenant_read" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.tenant_id = auth.tenant_id()
    )
  );

CREATE POLICY "order_items_service_write" ON order_items
  FOR ALL USING (auth.role() = 'service_role');

-- ── Step 10: Inventory log policies ──────────────────────────────────────────
CREATE POLICY "inventory_logs_tenant_read" ON inventory_logs
  FOR SELECT USING (tenant_id = auth.tenant_id());

CREATE POLICY "inventory_logs_service_write" ON inventory_logs
  FOR ALL USING (auth.role() = 'service_role');

-- ── Step 11: Staff invitation policies ───────────────────────────────────────
-- Only the inviting tenant can see/manage its own invitations. No public
-- read policy at all — invitation tokens are sensitive (they grant account
-- creation), so the only reads should go through the API's own token-hash
-- lookup, which uses the service-role connection regardless of RLS.
CREATE POLICY "staff_invitations_tenant_all" ON staff_invitations
  FOR ALL USING (tenant_id = auth.tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY: Run this query to check all tables have RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
-- ─────────────────────────────────────────────────────────────────────────────
