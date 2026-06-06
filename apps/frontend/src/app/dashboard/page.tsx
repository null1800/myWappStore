'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Package, Users, TrendingUp, ArrowRight, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency, formatRelative } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';

interface Summary {
  totalOrders: number;
  pendingOrders: number;
  todayOrders: number;
  totalRevenue: string;
  todayRevenue: string;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  currency: string;
  createdAt: string;
  customer: { fullName: string | null; whatsappNumber: string | null } | null;
  _count: { items: number };
}

export default function DashboardPage() {
  const { user, tenant } = useAuthStore();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/orders/summary'),
      api.get('/orders?limit=5'),
    ])
      .then(([summaryRes, ordersRes]) => {
        setSummary(summaryRes.data.data);
        setRecentOrders(ordersRes.data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" className="text-[var(--brand)]" />
      </div>
    );
  }

  const STAT_CARDS = [
    {
      label: 'Total Revenue',
      value: formatCurrency(summary?.totalRevenue ?? '0'),
      sub: `${formatCurrency(summary?.todayRevenue ?? '0')} today`,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Total Orders',
      value: summary?.totalOrders ?? 0,
      sub: `${summary?.todayOrders ?? 0} today`,
      icon: ShoppingCart,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Pending Orders',
      value: summary?.pendingOrders ?? 0,
      sub: 'Awaiting confirmation',
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  const STATUS_STYLE: Record<string, string> = {
    PENDING: 'badge badge-gray',
    CONFIRMED: 'badge badge-blue',
    PACKED: 'badge badge-amber',
    DISPATCHED: 'badge badge-amber',
    DELIVERED: 'badge badge-green',
    CANCELLED: 'badge badge-red',
    REFUNDED: 'badge badge-red',
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Good day, {user?.fullName?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Here&apos;s what&apos;s happening with <span className="font-medium text-[var(--brand)]">{tenant?.name}</span> today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STAT_CARDS.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="card p-5 flex items-start gap-4">
            <div className={`p-3 rounded-xl ${bg} shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">{label}</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-0.5">{value}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: '/dashboard/products/new', label: 'Add Product', icon: Package },
          { href: '/dashboard/orders',       label: 'View Orders', icon: ShoppingCart },
          { href: '/dashboard/customers',    label: 'Customers',   icon: Users },
          { href: '/dashboard/store',        label: 'Store Settings', icon: TrendingUp },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="card p-4 flex flex-col items-center gap-2 text-center hover:border-[var(--brand)] hover:shadow-md transition-all group"
          >
            <Icon className="w-5 h-5 text-[var(--brand)] group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
          </Link>
        ))}
      </div>

      {/* Recent orders */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--text-primary)]">Recent Orders</h2>
          <Link
            href="/dashboard/orders"
            className="text-sm text-[var(--brand)] hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <ShoppingCart className="w-10 h-10 text-[var(--text-muted)] mb-3" />
            <p className="font-medium text-[var(--text-primary)]">No orders yet</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Share your store link to start receiving orders via WhatsApp.
            </p>
            {tenant?.slug && (
              <Link
                href={`/${tenant.slug}`}
                target="_blank"
                className="mt-4 btn-primary text-sm px-4 py-2"
              >
                View My Storefront
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Order</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide hidden sm:table-cell">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Total</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide hidden md:table-cell">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-[var(--surface-2)] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/orders/${order.id}`} className="font-medium text-[var(--brand)] hover:underline">
                      {order.orderNumber}
                    </Link>
                    <p className="text-xs text-[var(--text-muted)]">{order._count.items} item{order._count.items !== 1 ? 's' : ''}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] hidden sm:table-cell">
                    {order.customer?.fullName ?? order.customer?.whatsappNumber ?? 'Guest'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={STATUS_STYLE[order.status] ?? 'badge badge-gray'}>
                      {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">
                    {formatCurrency(order.total, order.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-muted)] hidden md:table-cell">
                    {formatRelative(order.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
