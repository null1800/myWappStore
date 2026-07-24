'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, getStockStatus } from '@/lib/utils';
import { TableSkeleton, ErrorState } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: string;
  compareAtPrice: string | null;
  stockQuantity: number;
  trackInventory: boolean;
  status: string;
  images: string[];
  category: { name: string } | null;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [total, setTotal] = useState(0);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/products?${params}`);
      setProducts(data.data);
      setTotal(data.meta.total);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const STATUS_BADGE: Record<string, string> = {
    ACTIVE: 'badge badge-green',
    DRAFT: 'badge badge-gray',
    ARCHIVED: 'badge badge-red',
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Products</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{loading ? '…' : `${total} items in total`}</p>
        </div>
        <Link href="/dashboard/products/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          Add a New Item
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
          <input
            className="input pl-9"
            placeholder="Search products by name…"
            aria-label="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input max-w-[180px]"
          aria-label="Filter by visibility"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All items</option>
          <option value="ACTIVE">Visible to customers</option>
          <option value="DRAFT">Hidden (Draft)</option>
          <option value="ARCHIVED">Archived (Deleted)</option>
        </select>
      </div>

      {/* Table */}
      {error ? (
        <ErrorState message="Failed to load products." onRetry={fetchProducts} />
      ) : loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : products.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={<Package className="w-10 h-10" />}
            title="No products yet"
            description={search ? 'No products match your search.' : 'Add your first product to start selling.'}
          />
          {!search && (
            <div className="flex justify-center mt-4">
              <Link href="/dashboard/products/new" className="btn-primary">
                <Plus className="w-4 h-4" /> Add First Product
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide hidden md:table-cell">Category</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Price</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide hidden sm:table-cell">Stock</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {products.map((product) => {
                const stock = getStockStatus(product.stockQuantity, product.trackInventory);
                return (
                  <tr key={product.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/products/${product.id}`} className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-lg bg-[var(--surface-3)] overflow-hidden shrink-0 flex items-center justify-center text-xl">
                          {product.images?.[0]
                            ? <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                            : <span aria-hidden="true">📦</span>
                          }
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors">
                            {product.name}
                          </p>
                          {product.compareAtPrice && (
                            <p className="text-xs text-[var(--text-muted)] line-through">
                              {formatCurrency(product.compareAtPrice)}
                            </p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] hidden md:table-cell">
                      {product.category?.name ?? <span className="text-[var(--text-muted)]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">
                      {formatCurrency(product.price)}
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className={`badge ${stock.class.replace('badge-', 'badge badge-')}`}>
                        {product.trackInventory ? `${product.stockQuantity} · ${stock.label}` : 'Untracked'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={STATUS_BADGE[product.status] ?? 'badge badge-gray'}>
                        {product.status === 'ACTIVE' ? 'Visible' : product.status === 'DRAFT' ? 'Hidden' : 'Archived'}
                      </span>
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
