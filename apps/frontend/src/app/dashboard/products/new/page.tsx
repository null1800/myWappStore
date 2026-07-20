'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Upload, CheckCircle2, Tag, Palette, Ruler } from 'lucide-react';
import { api } from '@/lib/api';
import { generateSlug } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';

const DISPLAY_TYPES = [
  { value: 'featured', label: '⭐ Featured', desc: 'Highlighted in your storefront header' },
  { value: 'best seller', label: '🔥 Best Seller', desc: 'Top-selling item customers love' },
  { value: 'new arrival', label: '✨ New Arrival', desc: 'Just added to your catalog' },
  { value: 'latest', label: '🆕 Latest', desc: 'Your most recent addition' },
  { value: 'most popular', label: '📈 Most Popular', desc: 'Trending with customers' },
  { value: 'recommended', label: '👍 Recommended', desc: 'Personally curated by you' },
  { value: 'on sale', label: '🏷️ On Sale', desc: 'Discounted for a limited time' },
  { value: 'limited edition', label: '💎 Limited Edition', desc: 'Exclusive, only while supplies last' },
];

interface Category { id: string; name: string; }

interface ProductAttribute {
  colors: Array<{ name: string; hex: string }>;
  sizes: string[];
  customAttributes: Array<{ name: string; values: string[] }>;
}

function getSuggestedPresets(businessType?: string) {
  switch (businessType) {
    case 'RETAIL':
    case 'CLOTHING':
    case 'SHOES':
      return { sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] };
    case 'RESTAURANT':
      return { sizes: ['Small', 'Regular', 'Large', 'Family'] };
    case 'PHARMACY':
      return { sizes: ['Tablet', 'Capsule', 'Syrup', 'Cream'] };
    default:
      return { sizes: [] };
  }
}

// Helper functions for attribute serialization
function parseProductAttributes(tags: string[]): ProductAttribute {
  const metaTag = tags.find(t => t.startsWith('__meta:'));
  if (!metaTag) return { colors: [], sizes: [], customAttributes: [] };
  
  try {
    const jsonStr = metaTag.replace('__meta:', '');
    return JSON.parse(jsonStr);
  } catch {
    return { colors: [], sizes: [], customAttributes: [] };
  }
}

function serializeProductAttributes(attrs: ProductAttribute): string {
  return `__meta:${JSON.stringify(attrs)}`;
}

function updateTagsWithAttributes(tags: string[], attrs: ProductAttribute): string[] {
  const withoutMeta = tags.filter(t => !t.startsWith('__meta:'));
  const metaStr = serializeProductAttributes(attrs);
  return [...withoutMeta, metaStr];
}

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
  const [businessType, setBusinessType] = useState<string>('GENERAL');

  // Product attributes state
  const [attributes, setAttributes] = useState<ProductAttribute>({
    colors: [],
    sizes: [],
    customAttributes: []
  });
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#000000');
  const [newSize, setNewSize] = useState('');
  const [newCustomAttrName, setNewCustomAttrName] = useState('');
  const [newCustomAttrValue, setNewCustomAttrValue] = useState('');

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data.data)).catch(() => {});
    api.get('/stores/me').then(({ data }) => {
      const nextBusinessType = data.data.businessType || 'GENERAL';
      setBusinessType(nextBusinessType);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const presets = getSuggestedPresets(businessType);
    if (presets.sizes.length > 0 && attributes.sizes.length === 0) {
      setAttributes((prev) => ({ ...prev, sizes: presets.sizes }));
    }
  }, [businessType, attributes.sizes.length]);

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
      // Merge attributes into tags
      const finalTags = updateTagsWithAttributes(form.tags, attributes);
      
      const payload = {
        name:            form.name,
        slug:            form.slug || undefined,
        description:     form.description || undefined,
        price:           parseFloat(form.price),
        compareAtPrice:  form.compareAtPrice ? parseFloat(form.compareAtPrice) : undefined,
        sku:             form.sku || undefined,
        stockQuantity:   parseInt(form.stockQuantity, 10),
        trackInventory:  form.trackInventory,
        allowBackorder: form.allowBackorder,
        status:          publishNow ? 'ACTIVE' : form.status,
        categoryId:      form.categoryId || undefined,
        tags:            finalTags,
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

        {/* Product Display Type - predefined chips */}
        <div className="card p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Tag className="w-4 h-4 text-[var(--brand)]" />
              Product Showcase Type
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">Pick how this product is featured on your storefront. You can select one type.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DISPLAY_TYPES.map(({ value, label, desc }) => {
              const isActive = form.tags.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      tags: isActive
                        ? f.tags.filter((t) => t !== value)
                        : [...f.tags.filter((t) => !DISPLAY_TYPES.map((d) => d.value).includes(t)), value],
                    }))
                  }
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'border-[var(--brand)] bg-[var(--brand-light)] ring-1 ring-[var(--brand)]'
                      : 'border-[var(--border)] bg-[var(--surface-1)] hover:border-[var(--brand)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                    isActive ? 'border-[var(--brand)] bg-[var(--brand)]' : 'border-[var(--border)]'
                  }`}>
                    {isActive && <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${ isActive ? 'text-[var(--brand)]' : 'text-[var(--text-primary)]'}`}>{label}</p>
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mt-0.5">{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Show remaining custom tags (non display-type) */}
          {form.tags.filter(t => !DISPLAY_TYPES.map(d => d.value).includes(t)).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {form.tags.filter(t => !DISPLAY_TYPES.map(d => d.value).includes(t)).map((tag) => (
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

        {/* Product Attributes */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Palette className="w-4 h-4 text-[var(--brand)]" />
            Product Attributes
          </h2>
          <p className="text-xs text-[var(--text-muted)]">Add colors, sizes, and custom options (stored in tags)</p>

          {/* Colors */}
          <div className="space-y-2">
            <label className="label">Available Colors</label>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Color name (e.g. Navy Blue)"
                value={newColorName}
                onChange={(e) => setNewColorName(e.target.value)}
              />
              <input
                type="color"
                className="w-12 h-10 rounded cursor-pointer"
                value={newColorHex}
                onChange={(e) => setNewColorHex(e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  if (newColorName) {
                    setAttributes({
                      ...attributes,
                      colors: [...attributes.colors, { name: newColorName, hex: newColorHex }]
                    });
                    setNewColorName('');
                    setNewColorHex('#000000');
                  }
                }}
                className="btn-secondary"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {attributes.colors.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attributes.colors.map((color, idx) => (
                  <span key={idx} className="badge badge-gray gap-2 items-center">
                    <span className="w-4 h-4 rounded-full border" style={{ backgroundColor: color.hex }} />
                    {color.name}
                    <button
                      type="button"
                      onClick={() => setAttributes({
                        ...attributes,
                        colors: attributes.colors.filter((_, i) => i !== idx)
                      })}
                      className="hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sizes */}
          <div className="space-y-2">
            <label className="label flex items-center gap-2">
              <Ruler className="w-4 h-4" />
              Available Sizes
            </label>
            <p className="text-[11px] text-[var(--text-muted)]">Preset options are suggested for {businessType.toLowerCase()} stores.</p>
            <div className="flex flex-wrap gap-2">
              {getSuggestedPresets(businessType).sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    if (!attributes.sizes.includes(size)) {
                      setAttributes((prev) => ({ ...prev, sizes: [...prev.sizes, size] }));
                    }
                  }}
                  className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                  + {size}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Size (e.g. M, L, XL)"
                value={newSize}
                onChange={(e) => setNewSize(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSize) {
                    setAttributes({ ...attributes, sizes: [...attributes.sizes, newSize] });
                    setNewSize('');
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (newSize) {
                    setAttributes({ ...attributes, sizes: [...attributes.sizes, newSize] });
                    setNewSize('');
                  }
                }}
                className="btn-secondary"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {attributes.sizes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attributes.sizes.map((size, idx) => (
                  <span key={idx} className="badge badge-gray gap-1.5">
                    {size}
                    <button
                      type="button"
                      onClick={() => setAttributes({
                        ...attributes,
                        sizes: attributes.sizes.filter((_, i) => i !== idx)
                      })}
                      className="hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Custom Attributes */}
          <div className="space-y-2">
            <label className="label">Custom Attribute Groups</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                placeholder="Attribute name (e.g. Spice Level)"
                value={newCustomAttrName}
                onChange={(e) => setNewCustomAttrName(e.target.value)}
              />
              <input
                className="input"
                placeholder="Value (e.g. Mild)"
                value={newCustomAttrValue}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCustomAttrName && newCustomAttrValue) {
                    const existing = attributes.customAttributes.find(a => a.name === newCustomAttrName);
                    if (existing) {
                      setAttributes({
                        ...attributes,
                        customAttributes: attributes.customAttributes.map(a => 
                          a.name === newCustomAttrName 
                            ? { ...a, values: [...a.values, newCustomAttrValue] }
                            : a
                        )
                      });
                    } else {
                      setAttributes({
                        ...attributes,
                        customAttributes: [...attributes.customAttributes, { name: newCustomAttrName, values: [newCustomAttrValue] }]
                      });
                    }
                    setNewCustomAttrValue('');
                  }
                }}
                onChange={(e) => setNewCustomAttrValue(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (newCustomAttrName && newCustomAttrValue) {
                  const existing = attributes.customAttributes.find(a => a.name === newCustomAttrName);
                  if (existing) {
                    setAttributes({
                      ...attributes,
                      customAttributes: attributes.customAttributes.map(a => 
                        a.name === newCustomAttrName 
                          ? { ...a, values: [...a.values, newCustomAttrValue] }
                          : a
                      )
                    });
                  } else {
                    setAttributes({
                      ...attributes,
                      customAttributes: [...attributes.customAttributes, { name: newCustomAttrName, values: [newCustomAttrValue] }]
                    });
                  }
                  setNewCustomAttrValue('');
                }
              }}
              className="btn-secondary text-xs"
            >
              Add Value
            </button>
            {attributes.customAttributes.length > 0 && (
              <div className="space-y-2 mt-2">
                {attributes.customAttributes.map((attr, idx) => (
                  <div key={idx} className="bg-[var(--surface-2)] p-2 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{attr.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttributes({
                          ...attributes,
                          customAttributes: attributes.customAttributes.filter((_, i) => i !== idx)
                        })}
                        className="text-red-500 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {attr.values.map((val, vIdx) => (
                        <span key={vIdx} className="text-[10px] bg-white px-2 py-0.5 rounded border">{val}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
