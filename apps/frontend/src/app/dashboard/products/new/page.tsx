'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { generateSlug } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';

interface Category { id: string; name: string; }

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    price: '',
    compareAtPrice: '',
    sku: '',
    stockQuantity: '0',
    trackInventory: true,
    allowBackorder: false,
    status: 'DRAFT' as 'DRAFT' | 'ACTIVE',
    categoryId: '',
    tags: [] as string[],
    images: [] as string[],
  });

  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!slugEdited && form.name) {
      setForm((f) => ({ ...f, slug: generateSlug(f.name) }));
    }
  }, [form.name, slugEdited]);

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) {
      setForm((f) => ({ ...f, tags: [...f.tags, tag] }));
    }
    setTagInput('');
  };

  const handleSubmit = async (e: React.FormEvent, publishNow = false) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = {
        name:            form.name,
        slug:            form.slug || undefined,
        description:     form.description || undefined,
        price:           parseFloat(form.price),
        compareAtPrice:  form.compareAtPrice ? parseFloat(form.compareAtPrice) : undefined,
        sku:             form.sku || undefined,
        stockQuantity:   parseInt(form.stockQuantity, 10),
        trackInventory:  form.trackInventory,
        allowBackorder:  form.allowBackorder,
        status:          publishNow ? 'ACTIVE' : form.status,
        categoryId:      form.categoryId || undefined,
        tags:            form.tags,
        images:          form.images,
      };

      const { data } = await api.post('/products', payload);
      toast.success(`Product ${publishNow ? 'published' : 'saved as draft'}!`);
      router.push(`/dashboard/products/${data.data.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to create product');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl animate-fade-up">
      <Link href="/dashboard/products" className="btn-ghost -ml-2 mb-4 inline-flex">
        <ArrowLeft className="w-4 h-4" /> Back to products
      </Link>

      <h1 className="text-2xl font-display font-bold text-[var(--text-primary)] mb-6">Add Product</h1>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-5">

        {/* Basic info */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-[var(--text-primary)]">Basic Information</h2>

          <div>
            <label className="label">Product Name <span className="text-red-400">*</span></label>
            <input
              className="input"
              placeholder="iPhone 15 Case"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">URL Slug</label>
            <div className="relative">
              <input
                className="input"
                placeholder="iphone-15-case"
                value={form.slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') });
                }}
              />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">Auto-generated from name if left blank</p>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none"
              rows={4}
              placeholder="Describe your product…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Pricing */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-[var(--text-primary)]">Pricing</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price (ZMW) <span className="text-red-400">*</span></label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="140.00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Compare At Price</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                placeholder="200.00"
                value={form.compareAtPrice}
                onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })}
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">Shows as crossed-out "was" price</p>
            </div>
          </div>
        </div>

        {/* Inventory */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-[var(--text-primary)]">Inventory</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">SKU</label>
              <input
                className="input"
                placeholder="IPH-CASE-001"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Stock Quantity</label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.stockQuantity}
                onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-[var(--brand)]"
                checked={form.trackInventory}
                onChange={(e) => setForm({ ...form, trackInventory: e.target.checked })}
              />
              <span className="text-sm text-[var(--text-primary)]">Track inventory for this product</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-[var(--brand)]"
                checked={form.allowBackorder}
                onChange={(e) => setForm({ ...form, allowBackorder: e.target.checked })}
              />
              <span className="text-sm text-[var(--text-primary)]">Allow orders when out of stock</span>
            </label>
          </div>
        </div>

        {/* Tags */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-[var(--text-primary)]">Tags</h2>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Add a tag and press Enter"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            />
            <button type="button" onClick={addTag} className="btn-secondary shrink-0">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {form.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.tags.map((tag) => (
                <span key={tag} className="badge badge-gray gap-1.5">
                  {tag}
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Image URLs */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-[var(--text-primary)]">Images</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Upload images to Supabase Storage and paste the URLs here. Direct upload UI coming in Phase 2.
          </p>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="https://xxx.supabase.co/storage/v1/object/public/..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const url = (e.target as HTMLInputElement).value.trim();
                  if (url) {
                    setForm((f) => ({ ...f, images: [...f.images, url] }));
                    (e.target as HTMLInputElement).value = '';
                  }
                }
              }}
            />
            <button type="button" className="btn-secondary shrink-0">
              <Upload className="w-4 h-4" />
            </button>
          </div>
          {form.images.length > 0 && (
            <ul className="space-y-1.5">
              {form.images.map((url, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--surface-2)] px-3 py-2 rounded-lg">
                  <span className="flex-1 truncate">{url}</span>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }))}
                    className="shrink-0 hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pb-8">
          <button
            type="submit"
            disabled={isLoading}
            className="btn-secondary"
          >
            {isLoading ? <Spinner size="sm" /> : 'Save as Draft'}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={(e) => handleSubmit(e as any, true)}
            className="btn-primary"
          >
            {isLoading ? <Spinner size="sm" /> : 'Publish Product'}
          </button>
        </div>
      </form>
    </div>
  );
}
