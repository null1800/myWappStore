'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, ShoppingCart, Filter } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDateTime, ORDER_STATUS_BADGE, ORDER_STATUS_LABELS, PAYMENT_STATUS_BADGE } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  currency: string;
  paymentStatus: string;
  createdAt: string;
  customer: { fullName: string | null; whatsappNumber: string | null; phone: string | null } | null;
  _count: { items: number };
}

const STATUS_OPTIONS = [
  { value: '', label: 'All orders' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PACKED', label: 'Packed' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [total, setTotal] = useState(0);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '40' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/orders?${params}`);
      setOrders(data.data);
      setTotal(data.meta.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, []);
  useEffect(() => {
    const t = setTimeout(fetchOrders, 400);
    return () => clearTimeout(t);
  }, [search, statusFilter]);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Orders</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{total} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            className="input pl-9"
            placeholder="Search order # or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          <select
            className="input max-w-[160px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" className="text-[var(--brand)]" />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<ShoppingCart className="w-10 h-10" />}
              title="No orders found"
              description={search || statusFilter ? 'No orders match your filters.' : 'Orders will appear here when customers place them via your storefront.'}
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Order</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide hidden sm:table-cell">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Total</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide hidden lg:table-cell">Placed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {orders.map((order) => {
                const customerDisplay = order.customer?.fullName ?? order.customer?.whatsappNumber ?? order.customer?.phone ?? 'Guest';
                return (
                  <tr key={order.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/orders/${order.id}`} className="font-medium text-[var(--brand)] hover:underline">
                        {order.orderNumber}
                      </Link>
                      <p className="text-xs text-[var(--text-muted)]">{order._count.items} item{order._count.items !== 1 ? 's' : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] hidden sm:table-cell">
                      {customerDisplay}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={ORDER_STATUS_BADGE[order.status] ?? 'badge badge-gray'}>
                          {ORDER_STATUS_LABELS[order.status] ?? order.status}
                        </span>
                        <span className={PAYMENT_STATUS_BADGE[order.paymentStatus] ?? 'badge badge-gray'}>
                          {order.paymentStatus.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">
                      {formatCurrency(order.total, order.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--text-muted)] hidden lg:table-cell text-xs">
                      {formatDateTime(order.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
