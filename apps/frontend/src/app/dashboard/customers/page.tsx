'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import { TableSkeleton, ErrorState } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from 'sonner';

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
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ limit: '40' });
      if (search) params.set('search', search);
      const { data } = await api.get(`/customers?${params}`);
      setCustomers(data.data);
      setTotal(data.meta.total);
    } catch {
      setError(true);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Customers</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{loading ? '…' : `${total} total`}</p>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
        <input
          className="input pl-9"
          placeholder="Search customers…"
          aria-label="Search customers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error ? (
        <ErrorState message="Failed to load customers." onRetry={fetchCustomers} />
      ) : loading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : customers.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={<Users className="w-10 h-10" />}
            title="No customers yet"
            description={search ? 'No customers match your search.' : 'Customers will appear here after their first order.'}
          />
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide hidden sm:table-cell">Contact</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Orders</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide hidden md:table-cell">Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {customers.map((c) => {
                const display = c.fullName ?? c.phone ?? c.whatsappNumber ?? 'Anonymous';
                const initials = getInitials(display);
                return (
                  <tr key={c.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/customers/${c.id}`} className="flex items-center gap-3 group">
                        <div className="w-9 h-9 rounded-full bg-[var(--brand)] text-white text-xs font-bold flex items-center justify-center shrink-0" aria-hidden="true">
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors">
                            {display}
                          </p>
                          {c.email && <p className="text-xs text-[var(--text-muted)] truncate max-w-[180px]">{c.email}</p>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] text-xs hidden sm:table-cell">
                      {c.whatsappNumber ?? c.phone ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[var(--text-primary)]">
                      {c.totalOrders}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)] hidden md:table-cell">
                      {formatCurrency(c.totalSpent)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
