import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Period = '7d' | '30d' | '90d' | 'all';

function periodToDate(period: Period): Date | null {
  if (period === 'all') return null;
  const days = { '7d': 7, '30d': 30, '90d': 90 }[period];
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Sales summary ──────────────────────────────────────────────────────────
  async getSalesSummary(tenantId: string, period: Period) {
    const since = periodToDate(period);
    const where: any = {
      tenantId,
      status: { notIn: ['CANCELLED', 'REFUNDED'] },
      ...(since && { createdAt: { gte: since } }),
    };

    const agg = await this.prisma.order.aggregate({
      where,
      _count: { id: true },
      _sum: { total: true },
      _avg: { total: true },
    });

    // Daily revenue — split into two separate $queryRaw calls rather than
    // interpolating a $queryRaw inside another one (Prisma doesn't support
    // nested $queryRaw template literals; doing so sends a Promise as a
    // SQL parameter and produces a runtime error).
    const daily = since
      ? await this.prisma.$queryRaw<
          Array<{ date: string; revenue: string; orders: bigint }>
        >`
          SELECT
            TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS date,
            COALESCE(SUM(total), 0)::text AS revenue,
            COUNT(*)::bigint AS orders
          FROM orders
          WHERE tenant_id = ${tenantId}::uuid
            AND status NOT IN ('CANCELLED', 'REFUNDED')
            AND created_at >= ${since}
          GROUP BY DATE_TRUNC('day', created_at)
          ORDER BY DATE_TRUNC('day', created_at) ASC
        `
      : await this.prisma.$queryRaw<
          Array<{ date: string; revenue: string; orders: bigint }>
        >`
          SELECT
            TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS date,
            COALESCE(SUM(total), 0)::text AS revenue,
            COUNT(*)::bigint AS orders
          FROM orders
          WHERE tenant_id = ${tenantId}::uuid
            AND status NOT IN ('CANCELLED', 'REFUNDED')
          GROUP BY DATE_TRUNC('day', created_at)
          ORDER BY DATE_TRUNC('day', created_at) ASC
        `;

    return {
      period,
      totalRevenue: agg._sum?.total?.toString() ?? '0',
      totalOrders: typeof agg._count === 'object' && agg._count ? (agg._count as any).id ?? 0 : 0,
      avgOrderValue: agg._avg?.total?.toString() ?? '0',
      daily: daily.map((r: any) => ({
        date: r.date,
        revenue: r.revenue,
        orders: Number(r.orders),
      })),
    };
  }

  // ── Top products ───────────────────────────────────────────────────────────
  async getTopProducts(tenantId: string, period: Period, limit = 10) {
    const since = periodToDate(period);

    const rows = since
      ? await this.prisma.$queryRaw<
          Array<{ product_id: string | null; product_name: string; qty: bigint; revenue: string }>
        >`
          SELECT oi.product_id, oi.product_name,
            SUM(oi.quantity)::bigint AS qty,
            SUM(oi.line_total)::text AS revenue
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE o.tenant_id = ${tenantId}::uuid
            AND o.status NOT IN ('CANCELLED', 'REFUNDED')
            AND o.created_at >= ${since}
          GROUP BY oi.product_id, oi.product_name
          ORDER BY SUM(oi.line_total) DESC
          LIMIT ${limit}
        `
      : await this.prisma.$queryRaw<
          Array<{ product_id: string | null; product_name: string; qty: bigint; revenue: string }>
        >`
          SELECT oi.product_id, oi.product_name,
            SUM(oi.quantity)::bigint AS qty,
            SUM(oi.line_total)::text AS revenue
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE o.tenant_id = ${tenantId}::uuid
            AND o.status NOT IN ('CANCELLED', 'REFUNDED')
          GROUP BY oi.product_id, oi.product_name
          ORDER BY SUM(oi.line_total) DESC
          LIMIT ${limit}
        `;

    return rows.map((r: any) => ({
      productId: r.product_id,
      productName: r.product_name,
      unitsSold: Number(r.qty),
      revenue: r.revenue,
    }));
  }

  // ── Customer report ────────────────────────────────────────────────────────
  async getCustomerReport(tenantId: string, period: Period) {
    const since = periodToDate(period);

    const topCustomers = since
      ? await this.prisma.$queryRaw<
          Array<{
            customer_id: string;
            full_name: string | null;
            whatsapp_number: string | null;
            order_count: bigint;
            lifetime_value: string;
          }>
        >`
          SELECT c.id AS customer_id, c.full_name, c.whatsapp_number,
            COUNT(o.id)::bigint AS order_count,
            COALESCE(SUM(o.total), 0)::text AS lifetime_value
          FROM customers c
          JOIN orders o ON o.customer_id = c.id
          WHERE c.tenant_id = ${tenantId}::uuid
            AND o.status NOT IN ('CANCELLED', 'REFUNDED')
            AND o.created_at >= ${since}
          GROUP BY c.id, c.full_name, c.whatsapp_number
          ORDER BY COALESCE(SUM(o.total), 0) DESC
          LIMIT 10
        `
      : await this.prisma.$queryRaw<
          Array<{
            customer_id: string;
            full_name: string | null;
            whatsapp_number: string | null;
            order_count: bigint;
            lifetime_value: string;
          }>
        >`
          SELECT c.id AS customer_id, c.full_name, c.whatsapp_number,
            COUNT(o.id)::bigint AS order_count,
            COALESCE(SUM(o.total), 0)::text AS lifetime_value
          FROM customers c
          JOIN orders o ON o.customer_id = c.id
          WHERE c.tenant_id = ${tenantId}::uuid
            AND o.status NOT IN ('CANCELLED', 'REFUNDED')
          GROUP BY c.id, c.full_name, c.whatsapp_number
          ORDER BY COALESCE(SUM(o.total), 0) DESC
          LIMIT 10
        `;

    const totalCustomers = await this.prisma.customer.count({ where: { tenantId } });

    const repeatRows = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT customer_id)::bigint AS count
      FROM (
        SELECT customer_id
        FROM orders
        WHERE tenant_id = ${tenantId}::uuid
          AND status NOT IN ('CANCELLED', 'REFUNDED')
          AND customer_id IS NOT NULL
        GROUP BY customer_id
        HAVING COUNT(*) > 1
      ) AS repeat_buyers
    `;

    return {
      period,
      totalCustomers,
      repeatCustomers: Number(repeatRows[0]?.count ?? 0),
      topCustomers: topCustomers.map((r: any) => ({
        customerId: r.customer_id,
        fullName: r.full_name,
        whatsappNumber: r.whatsapp_number,
        orderCount: Number(r.order_count),
        lifetimeValue: r.lifetime_value,
      })),
    };
  }

  // ── Order status report ────────────────────────────────────────────────────
  async getOrderStatusReport(tenantId: string, period: Period) {
    const since = periodToDate(period);
    const where = {
      tenantId,
      ...(since && { createdAt: { gte: since } }),
    };

    const grouped = await this.prisma.order.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
      _sum: { total: true },
    });

    return grouped.map((g: any) => ({
      status: g.status,
      count: g._count.id,
      total: g._sum.total?.toString() ?? '0',
    }));
  }
}
