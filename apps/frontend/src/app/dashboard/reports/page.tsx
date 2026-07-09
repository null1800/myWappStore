'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Package, Users, ShoppingCart, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

type Period = '7d' | '30d' | '90d' | 'all';

interface SalesSummary {
  period: string;
  totalRevenue: string;
  totalOrders: number;
  avgOrderValue: string;
  daily: { date: string; revenue: string; orders: number }[];
}

interface TopProduct {
  productId: string | null;
  productName: string;
  unitsSold: number;
  revenue: string;
}

interface CustomerReport {
  totalCustomers: number;
  repeatCustomers: number;
  topCustomers: {
    customerId: string;
    fullName: string | null;
    whatsappNumber: string | null;
    orderCount: number;
    lifetimeValue: string;
  }[];
}

interface OrderStatusRow {
  status: string;
  count: number;
  total: string;
}

const PERIOD_LABELS: Record<Period, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  'all': 'All time',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PACKED: 'bg-indigo-100 text-indigo-700',
  DISPATCHED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-gray-100 text-gray-700',
};

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [customers, setCustomers] = useState<CustomerReport | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatusRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/reports/sales?period=${period}`),
      api.get(`/reports/products?period=${period}`),
      api.get(`/reports/customers?period=${period}`),
      api.get(`/reports/orders/status?period=${period}`),
    ]).then(([s, p, c, o]) => {
      setSales(s.data.data);
      setProducts(p.data.data ?? []);
      setCustomers(c.data.data);
      setOrderStatus(o.data.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Reports</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Sales performance and business insights.
          </p>
        </div>
        <div className="flex rounded-xl overflow-hidden border border-[var(--border)] shrink-0">
          {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([p, label]) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-[var(--brand)] text-white'
                  : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--background)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
        </div>
      ) : (
        <>
          {/* Sales summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'Total Revenue',
                value: formatCurrency(sales?.totalRevenue ?? '0'),
                icon: TrendingUp,
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
              },
              {
                label: 'Total Orders',
                value: sales?.totalOrders ?? 0,
                icon: ShoppingCart,
                color: 'text-blue-600',
                bg: 'bg-blue-50',
              },
              {
                label: 'Avg Order Value',
                value: formatCurrency(sales?.avgOrderValue ?? '0'),
                icon: TrendingUp,
                color: 'text-purple-600',
                bg: 'bg-purple-50',
              },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="card p-5 flex items-start gap-4">
                <div className={`p-3 rounded-xl ${bg} shrink-0`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">{label}</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)] mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top products */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
                <Package className="w-4 h-4 text-[var(--brand)]" />
                <h2 className="font-semibold text-[var(--text-primary)]">Top Products</h2>
              </div>
              {products.length === 0 ? (
                <p className="px-5 py-8 text-center text-[var(--text-muted)] text-sm">No sales data for this period.</p>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {products.map((p, i) => (
                    <div key={p.productId ?? i} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-bold text-[var(--text-muted)] w-5 shrink-0">#{i + 1}</span>
                        <p className="text-sm text-[var(--text-primary)] truncate">{p.productName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{formatCurrency(p.revenue)}</p>
                        <p className="text-xs text-[var(--text-muted)]">{p.unitsSold} sold</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order status breakdown */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[var(--brand)]" />
                <h2 className="font-semibold text-[var(--text-primary)]">Orders by Status</h2>
              </div>
              {orderStatus.length === 0 ? (
                <p className="px-5 py-8 text-center text-[var(--text-muted)] text-sm">No orders for this period.</p>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {orderStatus.map((row) => (
                    <div key={row.status} className="px-5 py-3 flex items-center justify-between gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {row.status}
                      </span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{row.count}</span>
                        <span className="text-xs text-[var(--text-muted)] ml-2">{formatCurrency(row.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer metrics */}
            <div className="card overflow-hidden lg:col-span-2">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[var(--brand)]" />
                  <h2 className="font-semibold text-[var(--text-primary)]">Top Customers</h2>
                </div>
                {customers && (
                  <div className="flex gap-4 text-sm text-[var(--text-secondary)]">
                    <span>{customers.totalCustomers} total</span>
                    <span>{customers.repeatCustomers} repeat</span>
                  </div>
                )}
              </div>
              {!customers || customers.topCustomers.length === 0 ? (
                <p className="px-5 py-8 text-center text-[var(--text-muted)] text-sm">No customer data for this period.</p>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {customers.topCustomers.map((c, i) => (
                    <div key={c.customerId} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-bold text-[var(--text-muted)] w-5 shrink-0">#{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {c.fullName ?? c.whatsappNumber ?? 'Anonymous'}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">{c.orderCount} orders</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-[var(--text-primary)] shrink-0">
                        {formatCurrency(c.lifetimeValue)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
