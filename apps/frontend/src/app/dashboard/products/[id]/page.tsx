'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Minus, History, CheckCircle2, Tag, Palette, Ruler, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatRelative, getStockStatus } from '@/lib/utils';
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

export default function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Stock adjustment state
  const [stockQty, setStockQty] = useState('');
  const [stockReason, setStockReason] = useState('restock');
  const [stockNote, setStockNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // Product attributes state
  const [attributes, setAttributes] = useState<ProductAttribute>({
    colors: [],
    sizes: [],
    customAttributes: []
  });
  const [businessType, setBusinessType] = useState('GENERAL');
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#000000');
  const [newSize, setNewSize] = useState('');
  const [newCustomAttrName, setNewCustomAttrName] = useState('');
  const [newCustomAttrValue, setNewCustomAttrValue] = useState('');

  useEffect(() => {
    api.get(`/products/${id}`)
      .then(({ data }) => {
        const prod = data.data;
        setProduct(prod);
        setAttributes(parseProductAttributes(prod.tags || []));
      })
      .catch(() => router.push('/dashboard/products'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    api.get('/stores/me').then(({ data }) => {
      setBusinessType(data.data.businessType || 'GENERAL');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const presets = getSuggestedPresets(businessType);
    if (presets.sizes.length > 0 && attributes.sizes.length === 0) {
      setAttributes((prev) => ({ ...prev, sizes: presets.sizes }));
    }
  }, [businessType, attributes.sizes.length]);

  const handleSave = async () => {
    if (!product) return;
    setSaving(true);
    try {
      // Merge attributes into tags
      const finalTags = updateTagsWithAttributes(product.tags, attributes);
      
      const { data } = await api.patch(`/products/${id}`, {
        name:           product.name,
        description:    product.description,
        price:          parseFloat(product.price),
        compareAtPrice: product.compareAtPrice ? parseFloat(product.compareAtPrice) : null,
        sku:            product.sku,
        trackInventory: product.trackInventory,
        allowBackorder: product.allowBackorder,
        status:         product.status,
        tags:           finalTags,
        images:         product.images,
        categoryId:     product.categoryId,
      });
      setProduct(data.data);
      toast.success('Product saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to save');
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
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Stock adjustment failed');
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

  return (
    <div className="max-w-2xl animate-fade-up space-y-6">
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
          <label className="label">SKU</label>
          <input
            className="input"
            value={product.sku ?? ''}
            onChange={(e) => setProduct((p) => p ? { ...p, sku: e.target.value } : p)}
          />
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

        {/* Product Showcase Type Chips */}
        <div className="card p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Tag className="w-4 h-4 text-[var(--brand)]" />
              Product Showcase Type
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">Pick how this product is featured on your storefront. Selecting one replaces any previous showcase type.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DISPLAY_TYPES.map(({ value, label, desc }) => {
              const isActive = product.tags.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setProduct((p) => p ? ({
                      ...p,
                      tags: isActive
                        ? p.tags.filter((t) => t !== value)
                        : [...p.tags.filter((t) => !DISPLAY_TYPES.map((d) => d.value).includes(t)), value],
                    }) : p)
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
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Spinner size="sm" /> : 'Save Changes'}
          </button>
          <Link href="/dashboard/products" className="btn-ghost">Cancel</Link>
        </div>
      </div>
    </div>
  );
}
