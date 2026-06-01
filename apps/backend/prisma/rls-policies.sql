-- ─────────────────────────────────────────────────────────────────────────────
-- MyWAppStore — Row Level Security Policies
-- Run this in Supabase SQL Editor AFTER running Prisma migrations
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Step 1: Enable RLS on all tenant-scoped tables ────────────────────────────
ALTER TABLE tenants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY: Run this query to check all tables have RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
-- ─────────────────────────────────────────────────────────────────────────────
