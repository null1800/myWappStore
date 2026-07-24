'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Minus, History, CheckCircle2, Tag,
  Palette, Ruler, X, Bot, ImageIcon, ChevronUp, ChevronDown, AlertCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatRelative, getStockStatus } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';

// ─── Constants (keep in sync with /new/page.tsx) ─────────────────────────────

const DISPLAY_TYPES = [
  { value: 'featured',        label: '⭐ Featured',        desc: 'Highlighted in storefront header' },
  { value: 'best seller',     label: '🔥 Best Seller',     desc: 'Top-selling item customers love' },
  { value: 'new arrival',     label: '✨ New Arrival',     desc: 'Just added to your catalog' },
  { value: 'on sale',         label: '🏷️ On Sale',         desc: 'Discounted for a limited time' },
  { value: 'recommended',     label: '👍 Recommended',     desc: 'Personally curated by you' },
  { value: 'limited edition', label: '💎 Limited Edition', desc: 'Exclusive, while supplies last' },
];

const DYNAMIC_FIELD_TEMPLATES: Record<string, {
  label: string;
  icon: string;
  fields: Array<{ key: string; label: string; placeholder: string; type?: string }>;
  sizePresets?: string[];
}> = {
  CLOTHING: {
    label: 'Fashion & Clothing',
    icon: '👕',
    fields: [
      { key: 'brand',      label: 'Brand',      placeholder: 'e.g. Nike, Zara, Local' },
      { key: 'material',   label: 'Material',   placeholder: 'e.g. 100% Cotton, Polyester' },
      { key: 'gender',     label: 'Gender',     placeholder: 'e.g. Unisex, Men, Women, Kids' },
      { key: 'collection', label: 'Collection', placeholder: 'e.g. Summer 2025, Workwear' },
    ],
    sizePresets: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  },
  ELECTRONICS: {
    label: 'Electronics',
    icon: '💻',
    fields: [
      { key: 'brand',        label: 'Brand / Manufacturer', placeholder: 'e.g. Samsung, Apple, HP' },
      { key: 'model',        label: 'Model Number',         placeholder: 'e.g. SM-G998B' },
      { key: 'warranty',     label: 'Warranty Period',      placeholder: 'e.g. 12 Months' },
      { key: 'voltage',      label: 'Voltage / Power',      placeholder: 'e.g. 220V, 45W' },
      { key: 'connectivity', label: 'Connectivity',         placeholder: 'e.g. Bluetooth 5.0, WiFi 6' },
    ],
    sizePresets: ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'],
  },
  RESTAURANT: {
    label: 'Food & Restaurant',
    icon: '🍔',
    fields: [
      { key: 'ingredients', label: 'Main Ingredients',   placeholder: 'e.g. Chicken, Tomatoes, Onions' },
      { key: 'allergens',   label: 'Allergens',          placeholder: 'e.g. Nuts, Gluten, Dairy' },
      { key: 'calories',    label: 'Calories (approx.)', placeholder: 'e.g. 450 kcal' },
      { key: 'prepTime',    label: 'Preparation Time',   placeholder: 'e.g. 15-20 minutes' },
    ],
    sizePresets: ['Small', 'Regular', 'Large', 'Family Size'],
  },
  GROCERY: {
    label: 'Grocery',
    icon: '🍎',
    fields: [
      { key: 'brand',  label: 'Brand',            placeholder: 'e.g. Freshmark' },
      { key: 'weight', label: 'Weight / Volume',  placeholder: 'e.g. 500g, 1L, 2kg' },
      { key: 'origin', label: 'Country of Origin', placeholder: 'e.g. Zambia, South Africa' },
    ],
  },
  PHARMACY: {
    label: 'Pharmacy & Health',
    icon: '💊',
    fields: [
      { key: 'brand',        label: 'Brand',        placeholder: 'e.g. Panadol, Bayer' },
      { key: 'dosage',       label: 'Dosage',       placeholder: 'e.g. 500mg, 10ml' },
      { key: 'formulation',  label: 'Formulation',  placeholder: 'e.g. Tablet, Capsule, Syrup' },
      { key: 'prescription', label: 'Prescription', placeholder: 'e.g. OTC / Prescription Only' },
    ],
    sizePresets: ['Tablet', 'Capsule', 'Syrup', 'Cream', 'Drops'],
  },
  SERVICE: {
    label: 'Service',
    icon: '📅',
    fields: [
      { key: 'duration', label: 'Duration',         placeholder: 'e.g. 1 Hour, 30 Minutes' },
      { key: 'location', label: 'Service Location', placeholder: 'e.g. On-site, Remote, Our Premises' },
    ],
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface Category { id: string; name: string; }

interface ProductAttribute {
  colors: Array<{ name: string; hex: string }>;
  sizes: string[];
  customAttributes: Array<{ name: string; values: string[] }>;
  dynamicFields: Record<string, string>;
}

// ─── Serialization helpers ────────────────────────────────────────────────────

function parseProductAttributes(tags: string[]): ProductAttribute {
  const metaTag = tags.find(t => t.startsWith('__meta:'));
  if (!metaTag) return { colors: [], sizes: [], customAttributes: [], dynamicFields: {} };
  try {
    const parsed = JSON.parse(metaTag.replace('__meta:', ''));
    return { dynamicFields: {}, ...parsed };
  } catch {
    return { colors: [], sizes: [], customAttributes: [], dynamicFields: {} };
  }
}

function serializeProductAttributes(attrs: ProductAttribute): string {
  return `__meta:${JSON.stringify(attrs)}`;
}

function updateTagsWithAttributes(tags: string[], attrs: ProductAttribute): string[] {
  const withoutMeta = tags.filter(t => !t.startsWith('__meta:'));
  return [...withoutMeta, serializeProductAttributes(attrs)];
}

// ─── Image Uploader (same as /new/page.tsx) ───────────────────────────────────

interface ImageUploaderProps {
  images: string[];
  onChange: (imgs: string[]) => void;
}

function ImageUploader({ images, onChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file.'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setTimeout(() => {
        onChange([...images, dataUrl]);
        setUploading(false);
        toast.success('Image added.');
      }, 500);
    };
    reader.readAsDataURL(file);
  }, [images, onChange]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    Array.from(e.dataTransfer.files).forEach(processFile);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(processFile);
    e.target.value = '';
  };

  const moveImage = (idx: number, dir: 'up' | 'down') => {
    const next = [...images];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center gap-2 ${
          dragging ? 'border-[var(--brand)] bg-[var(--brand)]/[0.04]' : 'border-[var(--border)] hover:border-[var(--brand)] bg-slate-50'
        }`}
      >
        {uploading ? <Spinner size="md" className="text-[var(--brand)]" /> : (
          <>
            <ImageIcon className="w-7 h-7 text-slate-400" />
            <span className="text-sm font-semibold text-slate-600">Drag & drop images here, or click to browse</span>
            <span className="text-[11px] text-slate-400">PNG, JPG, WEBP — Multiple files supported</span>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((src, idx) => (
            <div key={idx} className="relative group rounded-xl overflow-hidden border border-[var(--border)] bg-slate-50">
              <img src={src} alt={`Product image ${idx + 1}`} className="w-full aspect-square object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all" />
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button type="button" disabled={idx === 0} onClick={() => moveImage(idx, 'up')} className="w-6 h-6 rounded bg-white/90 flex items-center justify-center text-slate-700 hover:bg-white disabled:opacity-40">
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button type="button" disabled={idx === images.length - 1} onClick={() => moveImage(idx, 'down')} className="w-6 h-6 rounded bg-white/90 flex items-center justify-center text-slate-700 hover:bg-white disabled:opacity-40">
                  <ChevronDown className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => onChange(images.filter((_, i) => i !== idx))} className="w-6 h-6 rounded bg-red-500 flex items-center justify-center text-white hover:bg-red-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
              {idx === 0 && (
                <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold bg-[var(--brand)] text-white px-1.5 py-0.5 rounded">MAIN</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  // Stock adjustment
  const [stockQty, setStockQty] = useState('');
  const [stockReason, setStockReason] = useState('restock');
  const [stockNote, setStockNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // Business context
  const [businessType, setBusinessType] = useState('GENERAL');
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<string>('');

  // Attributes
  const [attributes, setAttributes] = useState<ProductAttribute>({
    colors: [], sizes: [], customAttributes: [], dynamicFields: {}
  });
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#000000');
  const [newSize, setNewSize] = useState('');
  const [newCustomAttrName, setNewCustomAttrName] = useState('');
  const [newCustomAttrValue, setNewCustomAttrValue] = useState('');

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      api.get(`/products/${id}`),
      api.get('/stores/me'),
      api.get('/categories'),
    ])
      .then(([prodRes, storeRes, catRes]) => {
        const prod = prodRes.data.data;
        setProduct(prod);
        const parsedAttrs = parseProductAttributes(prod.tags || []);
        setAttributes(parsedAttrs);

        const bType = storeRes.data.data.businessType || 'GENERAL';
        const modules: string[] = storeRes.data.data.enabledModules || [];
        setBusinessType(bType);
        setEnabledModules(modules);

        // Auto-detect template from existing dynamic fields or business type
        const allModules = [bType, ...modules];
        const firstMatch = allModules.find(m => DYNAMIC_FIELD_TEMPLATES[m]);
        if (firstMatch) setActiveTemplate(firstMatch);

        setCategories(catRes.data.data || []);
      })
      .catch(() => router.push('/dashboard/products'))
      .finally(() => setLoading(false));
  }, [id]);

  // ── AI Description ─────────────────────────────────────────────────────────

  const generateAIDescription = () => {
    if (!product?.name) { toast.error('Product name required'); return; }
    setAiGenerating(true);
    const template = DYNAMIC_FIELD_TEMPLATES[activeTemplate];
    setTimeout(() => {
      const label = template?.label || businessType.toLowerCase();
      const options = [
        `Premium quality ${product.name} designed for everyday use. Crafted with care and built to last. Ideal for ${label} enthusiasts looking for value and performance.`,
        `Introducing the ${product.name} — a top-tier choice in the ${label} category. Experience superior quality backed by our satisfaction guarantee.`,
      ];
      setProduct(p => p ? { ...p, description: options[Math.floor(Math.random() * options.length)] } : p);
      setAiGenerating(false);
      toast.success('AI description generated!');
    }, 900);
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!product) return;
    setSaving(true);
    try {
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
      toast.success('Product saved!');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Stock Adjustment ───────────────────────────────────────────────────────

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
      setProduct(p => p ? { ...p, stockQuantity: data.data.stockQuantity } : p);
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

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner size="lg" className="text-[var(--brand)]" /></div>;
  if (!product) return null;

  const stock = getStockStatus(product.stockQuantity, product.trackInventory);
  const currentTemplate = DYNAMIC_FIELD_TEMPLATES[activeTemplate];
  const availableTemplates = [businessType, ...enabledModules].filter(m => DYNAMIC_FIELD_TEMPLATES[m]);

  return (
    <div className="max-w-2xl animate-fade-up space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <Link href="/dashboard/products" className="btn-ghost -ml-2 mb-3 inline-flex">
          <ArrowLeft className="w-4 h-4" /> Back to products
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">{product.name}</h1>
            {currentTemplate && (
              <p className="text-xs text-[var(--text-muted)] mt-1">{currentTemplate.icon} {currentTemplate.label} product</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`badge ${product.status === 'ACTIVE' ? 'badge-green' : product.status === 'DRAFT' ? 'badge-gray' : 'badge-red'}`}>
              {product.status === 'ACTIVE' ? 'Visible' : product.status === 'DRAFT' ? 'Draft' : 'Archived'}
            </span>
            {availableTemplates.length > 0 && (
              <select
                className="input text-xs py-1.5 w-auto"
                value={activeTemplate}
                onChange={e => setActiveTemplate(e.target.value)}
              >
                <option value="">General</option>
                {availableTemplates.map(m => (
                  <option key={m} value={m}>{DYNAMIC_FIELD_TEMPLATES[m]?.icon} {DYNAMIC_FIELD_TEMPLATES[m]?.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ── Visibility Card ─────────────────────────────────────────────────── */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--text-primary)]">Visibility</p>
          <p className="text-xs text-[var(--text-muted)]">
            {product.status === 'ACTIVE' ? 'Visible on your storefront' : 'Hidden from your storefront'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {product.status !== 'ACTIVE' && (
            <button onClick={() => setProduct(p => p ? { ...p, status: 'ACTIVE' } : p)} className="btn-primary text-xs px-3 py-2">
              Make Visible
            </button>
          )}
          {product.status === 'ACTIVE' && (
            <button onClick={() => setProduct(p => p ? { ...p, status: 'DRAFT' } : p)} className="btn-secondary text-xs px-3 py-2">
              Hide Item
            </button>
          )}
          <button onClick={archive} className="btn-ghost text-xs text-red-500 hover:text-red-600 px-3 py-2">
            Delete
          </button>
        </div>
      </div>

      {/* ── Inventory Card ──────────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[var(--text-primary)]">Inventory</h2>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-display">{product.stockQuantity}</span>
            <span className={`badge badge-${stock.class.split('-')[1] || 'gray'}`}>{stock.label}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Adjust Quantity</label>
              <input className="input" type="number" min="1" placeholder="e.g. 10" value={stockQty} onChange={e => setStockQty(e.target.value)} />
            </div>
            <div>
              <label className="label">Reason</label>
              <select className="input" value={stockReason} onChange={e => setStockReason(e.target.value)}>
                <option value="restock">Restock</option>
                <option value="adjustment">Manual adjustment</option>
                <option value="return">Customer return</option>
                <option value="damage">Damaged / lost</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input className="input" placeholder="e.g. New delivery from supplier" value={stockNote} onChange={e => setStockNote(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleStockAdjust(1)} disabled={adjusting} className="btn-primary flex-1">
              {adjusting ? <Spinner size="sm" /> : <><Plus className="w-4 h-4" /> Add Stock</>}
            </button>
            <button onClick={() => handleStockAdjust(-1)} disabled={adjusting} className="btn-secondary flex-1">
              {adjusting ? <Spinner size="sm" /> : <><Minus className="w-4 h-4" /> Remove Stock</>}
            </button>
          </div>
          <Link href={`/dashboard/products/${id}/inventory`} className="btn-ghost w-full justify-center text-sm text-[var(--text-secondary)]">
            <History className="w-4 h-4" /> View inventory history
          </Link>
        </div>
      </div>

      {/* ── Basic Details ──────────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-[var(--text-primary)]">Basic Information</h2>

        <div>
          <label className="label">Product Name</label>
          <input className="input" value={product.name} onChange={e => setProduct(p => p ? { ...p, name: e.target.value } : p)} />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label">Description</label>
            <button type="button" onClick={generateAIDescription} disabled={aiGenerating} className="text-xs text-[var(--brand)] flex items-center gap-1 font-medium hover:opacity-80">
              {aiGenerating ? <Spinner size="sm" /> : <Bot className="w-3.5 h-3.5" />}
              AI Rewrite
            </button>
          </div>
          <textarea
            className="input resize-none"
            rows={4}
            value={product.description ?? ''}
            onChange={e => setProduct(p => p ? { ...p, description: e.target.value } : p)}
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
              onChange={e => setProduct(p => p ? { ...p, price: e.target.value } : p)}
            />
          </div>
          <div>
            <label className="label">Original / Was Price</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={product.compareAtPrice ?? ''}
              onChange={e => setProduct(p => p ? { ...p, compareAtPrice: e.target.value || null } : p)}
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">Leave empty unless showing discount.</p>
          </div>
        </div>

        <div>
          <label className="label">Product Code (SKU)</label>
          <input className="input" value={product.sku ?? ''} onChange={e => setProduct(p => p ? { ...p, sku: e.target.value } : p)} />
        </div>

        <div>
          <label className="label">Category</label>
          <select
            className="input"
            value={product.categoryId ?? ''}
            onChange={e => setProduct(p => p ? { ...p, categoryId: e.target.value || null } : p)}
          >
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {categories.length === 0 && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              No categories yet — <Link href="/dashboard/categories" className="underline">create one first</Link>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 accent-[var(--brand)]" checked={product.trackInventory} onChange={e => setProduct(p => p ? { ...p, trackInventory: e.target.checked } : p)} />
            <span className="text-sm">Automatically stop selling when stock runs out</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 accent-[var(--brand)]" checked={product.allowBackorder} onChange={e => setProduct(p => p ? { ...p, allowBackorder: e.target.checked } : p)} />
            <span className="text-sm">Allow orders even when out of stock</span>
          </label>
        </div>
      </div>

      {/* ── Dynamic Fields (based on module) ──────────────────────────────── */}
      {currentTemplate && currentTemplate.fields.length > 0 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">{currentTemplate.icon}</span>
            <h2 className="font-semibold text-[var(--text-primary)]">{currentTemplate.label} Details</h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] -mt-2">These fields are specific to {currentTemplate.label} products.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {currentTemplate.fields.map(field => (
              <div key={field.key}>
                <label className="label">{field.label}</label>
                <input
                  className="input"
                  type={field.type || 'text'}
                  placeholder={field.placeholder}
                  value={attributes.dynamicFields?.[field.key] || ''}
                  onChange={e => setAttributes(prev => ({
                    ...prev,
                    dynamicFields: { ...(prev.dynamicFields || {}), [field.key]: e.target.value }
                  }))}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Product Showcase Type ──────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Tag className="w-4 h-4 text-[var(--brand)]" />
            Storefront Showcase
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">How is this product featured on your storefront?</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DISPLAY_TYPES.map(({ value, label, desc }) => {
            const isActive = product.tags?.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setProduct(p => p ? ({
                    ...p,
                    tags: isActive
                      ? p.tags.filter(t => t !== value)
                      : [...p.tags.filter(t => !DISPLAY_TYPES.map(d => d.value).includes(t)), value],
                  }) : p)
                }
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                  isActive
                    ? 'border-[var(--brand)] bg-[var(--brand)]/[0.04] ring-1 ring-[var(--brand)]'
                    : 'border-[var(--border)] bg-white hover:border-slate-300'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                  isActive ? 'border-[var(--brand)] bg-[var(--brand)]' : 'border-[var(--border)]'
                }`}>
                  {isActive && <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
                <div>
                  <p className={`text-sm font-bold ${isActive ? 'text-[var(--brand)]' : 'text-[var(--text-primary)]'}`}>{label}</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Product Attributes ─────────────────────────────────────────────── */}
      <div className="card p-5 space-y-5">
        <div>
          <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Palette className="w-4 h-4 text-[var(--brand)]" />
            Product Options & Attributes
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">Colors, sizes, and options customers can choose from.</p>
        </div>

        {/* Colors */}
        <div className="space-y-2">
          <label className="label">Available Colors</label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Color name (e.g. Navy Blue)"
              value={newColorName}
              onChange={e => setNewColorName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newColorName) {
                  e.preventDefault();
                  setAttributes(prev => ({ ...prev, colors: [...prev.colors, { name: newColorName, hex: newColorHex }] }));
                  setNewColorName(''); setNewColorHex('#000000');
                }
              }}
            />
            <input type="color" className="w-12 h-10 rounded border cursor-pointer" value={newColorHex} onChange={e => setNewColorHex(e.target.value)} />
            <button type="button" onClick={() => { if (newColorName) { setAttributes(prev => ({ ...prev, colors: [...prev.colors, { name: newColorName, hex: newColorHex }] })); setNewColorName(''); setNewColorHex('#000000'); } }} className="btn-secondary">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {attributes.colors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attributes.colors.map((color, idx) => (
                <span key={idx} className="badge badge-gray gap-2 items-center">
                  <span className="w-3.5 h-3.5 rounded-full border" style={{ backgroundColor: color.hex }} />
                  {color.name}
                  <button type="button" onClick={() => setAttributes(prev => ({ ...prev, colors: prev.colors.filter((_, i) => i !== idx) }))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Sizes */}
        <div className="space-y-2">
          <label className="label flex items-center gap-2">
            <Ruler className="w-3.5 h-3.5" />
            {activeTemplate === 'RESTAURANT' ? 'Portion Sizes' : 'Available Sizes'}
          </label>
          {currentTemplate?.sizePresets && (
            <div className="flex flex-wrap gap-2">
              {currentTemplate.sizePresets.map(size => (
                <button key={size} type="button"
                  onClick={() => { if (!attributes.sizes.includes(size)) setAttributes(prev => ({ ...prev, sizes: [...prev.sizes, size] })); }}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    attributes.sizes.includes(size) ? 'border-[var(--brand)] bg-[var(--brand)]/[0.08] text-[var(--brand)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--brand)]'
                  }`}
                >
                  {attributes.sizes.includes(size) ? '✓ ' : '+ '}{size}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Custom size" value={newSize} onChange={e => setNewSize(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newSize) { e.preventDefault(); setAttributes(prev => ({ ...prev, sizes: [...prev.sizes, newSize] })); setNewSize(''); } }}
            />
            <button type="button" onClick={() => { if (newSize) { setAttributes(prev => ({ ...prev, sizes: [...prev.sizes, newSize] })); setNewSize(''); } }} className="btn-secondary">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {attributes.sizes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attributes.sizes.map((size, idx) => (
                <span key={idx} className="badge badge-gray gap-1.5">
                  {size}
                  <button type="button" onClick={() => setAttributes(prev => ({ ...prev, sizes: prev.sizes.filter((_, i) => i !== idx) }))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Custom Attributes */}
        <div className="space-y-2">
          <label className="label">Custom Attribute Groups</label>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Group name (e.g. Spice Level)" value={newCustomAttrName} onChange={e => setNewCustomAttrName(e.target.value)} />
            <input className="input" placeholder="Value (e.g. Mild)" value={newCustomAttrValue} onChange={e => setNewCustomAttrValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newCustomAttrName && newCustomAttrValue) {
                  e.preventDefault();
                  const existing = attributes.customAttributes.find(a => a.name === newCustomAttrName);
                  if (existing) setAttributes(prev => ({ ...prev, customAttributes: prev.customAttributes.map(a => a.name === newCustomAttrName ? { ...a, values: [...a.values, newCustomAttrValue] } : a) }));
                  else setAttributes(prev => ({ ...prev, customAttributes: [...prev.customAttributes, { name: newCustomAttrName, values: [newCustomAttrValue] }] }));
                  setNewCustomAttrValue('');
                }
              }}
            />
          </div>
          <button type="button" onClick={() => {
            if (newCustomAttrName && newCustomAttrValue) {
              const existing = attributes.customAttributes.find(a => a.name === newCustomAttrName);
              if (existing) setAttributes(prev => ({ ...prev, customAttributes: prev.customAttributes.map(a => a.name === newCustomAttrName ? { ...a, values: [...a.values, newCustomAttrValue] } : a) }));
              else setAttributes(prev => ({ ...prev, customAttributes: [...prev.customAttributes, { name: newCustomAttrName, values: [newCustomAttrValue] }] }));
              setNewCustomAttrValue('');
            }
          }} className="btn-secondary text-xs">Add Value</button>
          {attributes.customAttributes.map((attr, idx) => (
            <div key={idx} className="bg-slate-50 p-3 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">{attr.name}</span>
                <button type="button" onClick={() => setAttributes(prev => ({ ...prev, customAttributes: prev.customAttributes.filter((_, i) => i !== idx) }))} className="text-red-500"><X className="w-3 h-3" /></button>
              </div>
              <div className="flex flex-wrap gap-1">
                {attr.values.map((val, vIdx) => <span key={vIdx} className="text-[10px] bg-white px-2 py-0.5 rounded border">{val}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Images ─────────────────────────────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[var(--brand)]" />
            Product Images
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">First image is the main thumbnail. Drag & drop to reorder.</p>
        </div>
        <ImageUploader
          images={product.images}
          onChange={imgs => setProduct(p => p ? { ...p, images: imgs } : p)}
        />
      </div>

      {/* ── Actions ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pb-8">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <Spinner size="sm" /> : 'Save Changes'}
        </button>
        <Link href="/dashboard/products" className="btn-ghost">Cancel</Link>
      </div>

    </div>
  );
}
