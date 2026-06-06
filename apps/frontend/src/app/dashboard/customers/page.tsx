'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

interface Customer {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  totalOrders: number;
  totalSpent: string;
  createdAt: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '40' });
      if (search) params.set('search', search);
      const { data } = await api.get(`/customers?${params}`);
      setCustomers(data.data);
      setTotal(data.meta.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCustomers(); }, []);
  useEffect(() => {
    const t = setTimeout(fetchCustomers, 400);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">Customers</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{total} total</p>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          className="input pl-9"
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" className="text-[var(--brand)]" />
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={<Users className="w-12 h-12" />}
            title="No customers yet"
            description="Customers appear here automatically when they place orders."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide hidden sm:table-cell">Contact</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Orders</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide hidden md:table-cell">Spent</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide hidden lg:table-cell">Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {customers.map((c) => {
                const display = c.fullName ?? c.whatsappNumber ?? c.email ?? 'Guest';
                return (
                  <tr key={c.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/customers/${c.id}`} className="flex items-center gap-3 group">
                        <div className="w-8 h-8 rounded-full bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center text-xs font-bold shrink-0">
                          {getInitials(display)}
                        </div>
                        <span className="font-medium text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors">
                          {display}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-[var(--text-secondary)]">
                      {c.whatsappNumber ?? c.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[var(--text-primary)]">
                      {c.totalOrders}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)] hidden md:table-cell">
                      {formatCurrency(c.totalSpent)}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--text-muted)] hidden lg:table-cell">
                      {formatDate(c.createdAt)}
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
