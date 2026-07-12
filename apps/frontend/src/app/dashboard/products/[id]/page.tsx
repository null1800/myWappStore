'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Minus, History, X, Sparkles, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, getStockStatus } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';

interface Category { id: string; name: string; }

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { error?: { message?: unknown } } } }).response;
    const message = response?.data?.error?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

const merchandisingTags = ['new-arrival', 'best-seller', 'featured', 'limited-drop'];

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  compareAtPrice: string | null;
  sku: string | null;
  stockQuantity: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  status: string;
  images: string[];
  tags: string[];
  categoryId: string | null;
  category: { id: string; name: string } | null;
}

export default function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [imageInput, setImageInput] = useState('');

  // Stock adjustment state
  const [stockQty, setStockQty] = useState('');
  const [stockReason, setStockReason] = useState('restock');
  const [stockNote, setStockNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data.data)).catch(() => {});
    api.get(`/products/${id}`)
      .then(({ data }) => setProduct(data.data))
      .catch(() => router.push('/dashboard/products'))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleSave = async () => {
    if (!product) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/products/${id}`, {
        name:           product.name,
        description:    product.description,
        price:          parseFloat(product.price),
        compareAtPrice: product.compareAtPrice ? parseFloat(product.compareAtPrice) : null,
        sku:            product.sku,
        trackInventory: product.trackInventory,
        allowBackorder: product.allowBackorder,
        status:         product.status,
        tags:           product.tags,
        images:         product.images,
        categoryId:     product.categoryId,
      });
      setProduct(data.data);
      toast.success('Product saved');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const handleStockAdjust = async (direction: 1 | -1) => {
    const qty = parseInt(stockQty, 10);
    if (!qty || qty < 1) { toast.error('Enter a valid quantity'); return; }
    setAdjusting(true);
    try {
      const { data } = await api.patch(`/products/${id}/stock`, {
        changeQty: direction * qty,
        reason: stockReason,
        note: stockNote || undefined,
      });
      setProduct((p) => p ? { ...p, stockQuantity: data.data.stockQuantity } : p);
      setStockQty('');
      setStockNote('');
      toast.success(`Stock ${direction > 0 ? 'added' : 'removed'}: ${qty} units`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Stock adjustment failed'));
    } finally {
      setAdjusting(false);
    }
  };

  const archive = async () => {
    if (!confirm('Archive this product? It will be hidden from your storefront.')) return;
    await api.delete(`/products/${id}`);
    toast.success('Product archived');
    router.push('/dashboard/products');
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner size="lg" className="text-[var(--brand)]" /></div>;
  if (!product) return null;

  const stock = getStockStatus(product.stockQuantity, product.trackInventory);

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !product.tags.includes(tag)) {
      setProduct((p) => p ? { ...p, tags: [...p.tags, tag] } : p);
    }
    setTagInput('');
  };

  const addImage = () => {
    const url = imageInput.trim();
    if (!url) return;
    setProduct((p) => p ? { ...p, images: [...p.images, url] } : p);
    setImageInput('');
  };

  return (
    <div className="max-w-5xl animate-fade-up space-y-6">
      <div>
        <Link href="/dashboard/products" className="btn-ghost -ml-2 mb-3 inline-flex">
          <ArrowLeft className="w-4 h-4" /> Back to products
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">{product.name}</h1>
          <span className={`badge ${product.status === 'ACTIVE' ? 'badge-green' : product.status === 'DRAFT' ? 'badge-gray' : 'badge-red'}`}>
            {product.status.charAt(0) + product.status.slice(1).toLowerCase()}
          </span>
        </div>
      </div>

      {/* Publish / Archive toggle */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--text-primary)]">Visibility</p>
          <p className="text-xs text-[var(--text-muted)]">
            {product.status === 'ACTIVE' ? 'Visible on your storefront' : 'Hidden from your storefront'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {product.status !== 'ACTIVE' && (
            <button
              onClick={() => { setProduct((p) => p ? { ...p, status: 'ACTIVE' } : p); }}
              className="btn-primary text-xs px-3 py-2"
            >
              Publish
            </button>
          )}
          {product.status === 'ACTIVE' && (
            <button
              onClick={() => { setProduct((p) => p ? { ...p, status: 'DRAFT' } : p); }}
              className="btn-secondary text-xs px-3 py-2"
            >
              Unpublish
            </button>
          )}
          <button onClick={archive} className="btn-ghost text-xs text-red-500 hover:text-red-600 px-3 py-2">
            Archive
          </button>
        </div>
      </div>

      {/* Stock card */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[var(--text-primary)]">Inventory</h2>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-display">{product.stockQuantity}</span>
            <span className={`badge badge-${stock.class.split('-')[1]}`}>{stock.label}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Adjust Quantity</label>
              <input
                className="input"
                type="number"
                min="1"
                placeholder="e.g. 10"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Reason</label>
              <select
                className="input"
                value={stockReason}
                onChange={(e) => setStockReason(e.target.value)}
              >
                <option value="restock">Restock</option>
                <option value="adjustment">Manual adjustment</option>
                <option value="return">Customer return</option>
                <option value="damage">Damaged/lost</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input
              className="input"
              placeholder="e.g. New delivery from supplier"
              value={stockNote}
              onChange={(e) => setStockNote(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleStockAdjust(1)}
              disabled={adjusting}
              className="btn-primary flex-1"
            >
              {adjusting ? <Spinner size="sm" /> : <><Plus className="w-4 h-4" /> Add Stock</>}
            </button>
            <button
              onClick={() => handleStockAdjust(-1)}
              disabled={adjusting}
              className="btn-secondary flex-1"
            >
              {adjusting ? <Spinner size="sm" /> : <><Minus className="w-4 h-4" /> Remove Stock</>}
            </button>
          </div>
          <Link
            href={`/dashboard/products/${id}/inventory`}
            className="btn-ghost w-full justify-center text-sm text-[var(--text-secondary)]"
          >
            <History className="w-4 h-4" /> View inventory history
          </Link>
        </div>
      </div>

      {/* Edit form */}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-[var(--text-primary)]">Product Details</h2>

        <div>
          <label className="label">Name</label>
          <input className="input" value={product.name} onChange={(e) => setProduct((p) => p ? { ...p, name: e.target.value } : p)} />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            className="input resize-none"
            rows={4}
            value={product.description ?? ''}
            onChange={(e) => setProduct((p) => p ? { ...p, description: e.target.value } : p)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Price (ZMW)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={product.price}
              onChange={(e) => setProduct((p) => p ? { ...p, price: e.target.value } : p)}
            />
          </div>
          <div>
            <label className="label">Compare At Price</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={product.compareAtPrice ?? ''}
              onChange={(e) => setProduct((p) => p ? { ...p, compareAtPrice: e.target.value || null } : p)}
            />
          </div>
        </div>

        <div>
          <label className="label">Category</label>
          <select className="input" value={product.categoryId ?? ''} onChange={(e) => setProduct((p) => p ? { ...p, categoryId: e.target.value || null } : p)}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label">SKU</label>
          <input
            className="input"
            value={product.sku ?? ''}
            onChange={(e) => setProduct((p) => p ? { ...p, sku: e.target.value } : p)}
          />
        </div>


        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Storefront Tags & Badges</h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Control campaign tags, badge-ready labels, and storefront filters using existing product tags.</p>
            </div>
            <Sparkles className="h-5 w-5 text-[var(--brand)]" />
          </div>
          <div className="flex flex-wrap gap-2">
            {merchandisingTags.map((tag) => (
              <button key={tag} type="button" onClick={() => setProduct((p) => p && !p.tags.includes(tag) ? { ...p, tags: [...p.tags, tag] } : p)} className={`badge ${product.tags.includes(tag) ? 'badge-green' : 'badge-gray'} text-xs`}>
                {tag}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Add tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
            <button type="button" onClick={addTag} className="btn-secondary shrink-0"><Plus className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <span key={tag} className="badge badge-gray gap-1.5">{tag}<button type="button" onClick={() => setProduct((p) => p ? { ...p, tags: p.tags.filter((t) => t !== tag) } : p)}><X className="h-3 w-3" /></button></span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-3">
          <h3 className="font-semibold text-[var(--text-primary)]">Storefront Gallery</h3>
          <p className="text-xs text-[var(--text-muted)]">The first image is used as the main product card and product detail hero.</p>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Paste image URL" value={imageInput} onChange={(e) => setImageInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addImage(); } }} />
            <button type="button" onClick={addImage} className="btn-secondary shrink-0"><Upload className="h-4 w-4" /></button>
          </div>
          {product.images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {product.images.map((url, i) => (
                <div key={`${url}-${i}`} className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-3)]">
                  <img src={url} alt={`Product image ${i + 1}`} className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-[var(--brand)] px-2 py-0.5 text-[10px] font-bold text-white">Hero</span>}
                  <button type="button" onClick={() => setProduct((p) => p ? { ...p, images: p.images.filter((_, idx) => idx !== i) } : p)} className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 accent-[var(--brand)]"
              checked={product.trackInventory}
              onChange={(e) => setProduct((p) => p ? { ...p, trackInventory: e.target.checked } : p)}
            />
            <span className="text-sm">Track inventory</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 accent-[var(--brand)]"
              checked={product.allowBackorder}
              onChange={(e) => setProduct((p) => p ? { ...p, allowBackorder: e.target.checked } : p)}
            />
            <span className="text-sm">Allow backorders</span>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Spinner size="sm" /> : 'Save Changes'}
          </button>
          <Link href="/dashboard/products" className="btn-ghost">Cancel</Link>
        </div>
      </div>
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card overflow-hidden p-0">
          <div className="aspect-[4/3] bg-[var(--surface-3)]">
            {product.images[0] ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-5xl">📦</div>}
          </div>
          <div className="p-5">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand)]">Live storefront preview</p>
            <h3 className="mt-3 text-xl font-black text-[var(--text-primary)]">{product.name}</h3>
            <p className="mt-2 line-clamp-3 text-sm text-[var(--text-secondary)]">{product.description || 'No description yet.'}</p>
            <p className="mt-4 text-2xl font-black text-[var(--brand)]">{formatCurrency(product.price)}</p>
          </div>
        </div>
      </aside>
      </div>
    </div>
  );
}
