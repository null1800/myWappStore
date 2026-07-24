'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, X, Upload, CheckCircle2, Tag, Palette, Ruler,
  Bot, Sparkles, ImageIcon, GripVertical, ChevronDown, ChevronUp,
  Info, Zap, AlertCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import { generateSlug } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

const DISPLAY_TYPES = [
  { value: 'featured',       label: '⭐ Featured',       desc: 'Highlighted in storefront header' },
  { value: 'best seller',    label: '🔥 Best Seller',    desc: 'Top-selling item customers love' },
  { value: 'new arrival',    label: '✨ New Arrival',    desc: 'Just added to your catalog' },
  { value: 'on sale',        label: '🏷️ On Sale',        desc: 'Discounted for a limited time' },
  { value: 'recommended',    label: '👍 Recommended',    desc: 'Personally curated by you' },
  { value: 'limited edition',label: '💎 Limited Edition',desc: 'Exclusive, while supplies last' },
];

// Category-specific field templates keyed by module/business type
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
      { key: 'ingredients',    label: 'Main Ingredients',     placeholder: 'e.g. Chicken, Tomatoes, Onions' },
      { key: 'allergens',      label: 'Allergens',            placeholder: 'e.g. Nuts, Gluten, Dairy' },
      { key: 'calories',       label: 'Calories (approx.)',   placeholder: 'e.g. 450 kcal' },
      { key: 'prepTime',       label: 'Preparation Time',     placeholder: 'e.g. 15-20 minutes' },
    ],
    sizePresets: ['Small', 'Regular', 'Large', 'Family Size'],
  },
  GROCERY: {
    label: 'Grocery',
    icon: '🍎',
    fields: [
      { key: 'brand',      label: 'Brand',           placeholder: 'e.g. Freshmark' },
      { key: 'weight',     label: 'Weight / Volume', placeholder: 'e.g. 500g, 1L, 2kg' },
      { key: 'origin',     label: 'Country of Origin',placeholder: 'e.g. Zambia, South Africa' },
    ],
  },
  PHARMACY: {
    label: 'Pharmacy & Health',
    icon: '💊',
    fields: [
      { key: 'brand',       label: 'Brand',           placeholder: 'e.g. Panadol, Bayer' },
      { key: 'dosage',      label: 'Dosage',          placeholder: 'e.g. 500mg, 10ml' },
      { key: 'formulation', label: 'Formulation',     placeholder: 'e.g. Tablet, Capsule, Syrup' },
      { key: 'prescription',label: 'Prescription',    placeholder: 'e.g. OTC / Prescription Only' },
    ],
    sizePresets: ['Tablet', 'Capsule', 'Syrup', 'Cream', 'Drops'],
  },
  SERVICE: {
    label: 'Service',
    icon: '📅',
    fields: [
      { key: 'duration',    label: 'Duration',         placeholder: 'e.g. 1 Hour, 30 Minutes' },
      { key: 'location',    label: 'Service Location', placeholder: 'e.g. On-site, Remote, Our Premises' },
    ],
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category { id: string; name: string; }

interface ProductAttribute {
  colors: Array<{ name: string; hex: string }>;
  sizes: string[];
  customAttributes: Array<{ name: string; values: string[] }>;
  dynamicFields: Record<string, string>;
}

// ─── Serialization helpers (same format as existing codebase) ─────────────────

function serializeProductAttributes(attrs: ProductAttribute): string {
  return `__meta:${JSON.stringify(attrs)}`;
}

function updateTagsWithAttributes(tags: string[], attrs: ProductAttribute): string[] {
  const withoutMeta = tags.filter(t => !t.startsWith('__meta:'));
  return [...withoutMeta, serializeProductAttributes(attrs)];
}

// ─── Image Uploader Sub-component ─────────────────────────────────────────────

interface ImageUploaderProps {
  images: string[];
  onChange: (imgs: string[]) => void;
}

function ImageUploader({ images, onChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setTimeout(() => {
        onChange([...images, dataUrl]);
        setUploading(false);
        toast.success('Image added.');
      }, 600);
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
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center gap-2 ${
          dragging
            ? 'border-[var(--brand)] bg-[var(--brand)]/[0.04]'
            : 'border-[var(--border)] hover:border-[var(--brand)] bg-slate-50'
        }`}
      >
        {uploading ? (
          <Spinner size="md" className="text-[var(--brand)]" />
        ) : (
          <>
            <Upload className="w-7 h-7 text-slate-400" />
            <span className="text-sm font-semibold text-slate-600">Drag & drop images here, or click to browse</span>
            <span className="text-[11px] text-slate-400">PNG, JPG, WEBP — Multiple files supported</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((src, idx) => (
            <div key={idx} className="relative group rounded-xl overflow-hidden border border-[var(--border)] bg-slate-50">
              <img
                src={src}
                alt={`Product image ${idx + 1}`}
                className="w-full aspect-square object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all" />
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveImage(idx, 'up')}
                  className="w-6 h-6 rounded bg-white/90 flex items-center justify-center text-slate-700 hover:bg-white disabled:opacity-40"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={idx === images.length - 1}
                  onClick={() => moveImage(idx, 'down')}
                  className="w-6 h-6 rounded bg-white/90 flex items-center justify-center text-slate-700 hover:bg-white disabled:opacity-40"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(images.filter((_, i) => i !== idx))}
                  className="w-6 h-6 rounded bg-red-500 flex items-center justify-center text-white hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {idx === 0 && (
                <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold bg-[var(--brand)] text-white px-1.5 py-0.5 rounded">
                  MAIN
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function NewProductPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  // Business context loaded from store
  const [businessType, setBusinessType] = useState<string>('GENERAL');
  const [enabledModules, setEnabledModules] = useState<string[]>([]);

  // Active template (auto or manual)
  const [activeTemplate, setActiveTemplate] = useState<string>('');

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

  const [attributes, setAttributes] = useState<ProductAttribute>({
    colors: [],
    sizes: [],
    customAttributes: [],
    dynamicFields: {},
  });

  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#000000');
  const [newSize, setNewSize] = useState('');
  const [newCustomAttrName, setNewCustomAttrName] = useState('');
  const [newCustomAttrValue, setNewCustomAttrValue] = useState('');

  // ── Data Loading ─────────────────────────────────────────────────────────────

  useEffect(() => {
    // Load store context (business type + modules)
    api.get('/stores/me').then(({ data }) => {
      const bType = data.data.businessType || 'GENERAL';
      const modules: string[] = data.data.enabledModules || [];
      setBusinessType(bType);
      setEnabledModules(modules);

      // Auto-set first relevant template
      const allModules = [bType, ...modules];
      const firstMatch = allModules.find(m => DYNAMIC_FIELD_TEMPLATES[m]);
      if (firstMatch) setActiveTemplate(firstMatch);
    }).catch(() => {});

    // Load categories from the authenticated store
    api.get('/categories').then(({ data }) => {
      setCategories(data.data || []);
    }).catch(() => {});
  }, []);

  // Auto-suggest size presets when template changes
  useEffect(() => {
    const template = DYNAMIC_FIELD_TEMPLATES[activeTemplate];
    if (template?.sizePresets && attributes.sizes.length === 0) {
      setAttributes(prev => ({ ...prev, sizes: template.sizePresets! }));
    }
  }, [activeTemplate]);

  // Auto-generate slug
  useEffect(() => {
    if (!slugEdited && form.name) {
      setForm(f => ({ ...f, slug: generateSlug(f.name) }));
    }
  }, [form.name, slugEdited]);

  // ── AI Helpers ────────────────────────────────────────────────────────────────

  const generateAIDescription = () => {
    if (!form.name) { toast.error('Enter a product name first'); return; }
    setAiGenerating(true);
    setTimeout(() => {
      const template = DYNAMIC_FIELD_TEMPLATES[activeTemplate];
      const categoryLabel = template?.label || businessType.toLowerCase();
      const suggestions = [
        `Premium quality ${form.name} designed for everyday use. Crafted with care and built to last. Ideal for ${categoryLabel} enthusiasts looking for value and performance.`,
        `Introducing the ${form.name} — a top-tier choice in the ${categoryLabel} category. Experience superior quality backed by our satisfaction guarantee.`,
        `The ${form.name} is everything you need and more. Trusted by hundreds of customers for its reliability and unmatched quality in the ${categoryLabel} space.`,
      ];
      setForm(f => ({ ...f, description: suggestions[Math.floor(Math.random() * suggestions.length)] }));
      setAiGenerating(false);
      toast.success('AI description generated!');
    }, 1000);
  };

  // ── Available templates = primaryType + enabled modules ───────────────────────

  const availableTemplates = [businessType, ...enabledModules].filter(
    m => DYNAMIC_FIELD_TEMPLATES[m]
  );

  // ── Form Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent, publishNow = false) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const finalTags = updateTagsWithAttributes(form.tags, attributes);
      const payload = {
        name:           form.name,
        slug:           form.slug || undefined,
        description:    form.description || undefined,
        price:          parseFloat(form.price),
        compareAtPrice: form.compareAtPrice ? parseFloat(form.compareAtPrice) : undefined,
        sku:            form.sku || undefined,
        stockQuantity:  parseInt(form.stockQuantity, 10),
        trackInventory: form.trackInventory,
        allowBackorder: form.allowBackorder,
        status:         publishNow ? 'ACTIVE' : form.status,
        categoryId:     form.categoryId || undefined,
        tags:           finalTags,
        images:         form.images,
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

  const currentTemplate = DYNAMIC_FIELD_TEMPLATES[activeTemplate];

  return (
    <div className="max-w-2xl animate-fade-up">
      <Link href="/dashboard/products" className="btn-ghost -ml-2 mb-4 inline-flex">
        <ArrowLeft className="w-4 h-4" /> Back to products
      </Link>

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">Add New Product</h1>
          {currentTemplate && (
            <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1">
              <span>{currentTemplate.icon}</span>
              Fields dynamically loaded for <strong>{currentTemplate.label}</strong>
            </p>
          )}
        </div>

        {/* Template Selector */}
        {availableTemplates.length > 0 && (
          <div className="flex-shrink-0">
            <label className="label text-[10px]">Product Type</label>
            <select
              className="input text-xs py-1.5"
              value={activeTemplate}
              onChange={e => {
                setActiveTemplate(e.target.value);
                setAttributes(prev => ({ ...prev, sizes: [] })); // reset sizes when template changes
              }}
            >
              <option value="">General</option>
              {availableTemplates.map(m => (
                <option key={m} value={m}>
                  {DYNAMIC_FIELD_TEMPLATES[m]?.icon} {DYNAMIC_FIELD_TEMPLATES[m]?.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-5">

        {/* ── Basic Information ─────────────────────────────────────────────── */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-[var(--text-primary)]">Basic Information</h2>

          <div>
            <label className="label">Product Name <span className="text-red-400">*</span></label>
            <input
              className="input"
              placeholder={currentTemplate ? `e.g. ${currentTemplate.label} product name` : 'e.g. iPhone 15 Case'}
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">URL Slug (auto-generated)</label>
            <input
              className="input text-slate-500"
              placeholder="auto-generated-from-name"
              value={form.slug}
              onChange={e => {
                setSlugEdited(true);
                setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') });
              }}
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">Leave blank to auto-generate from product name.</p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="label">Description</label>
              <button
                type="button"
                onClick={generateAIDescription}
                disabled={aiGenerating}
                className="text-xs text-[var(--brand)] flex items-center gap-1 font-medium hover:opacity-80"
              >
                {aiGenerating ? <Spinner size="sm" /> : <Bot className="w-3.5 h-3.5" />}
                AI Write Description
              </button>
            </div>
            <textarea
              className="input resize-none"
              rows={4}
              placeholder="Describe what makes this product great…"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={form.categoryId}
              onChange={e => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">No category</option>
              {categories.length === 0 && (
                <option disabled value="">Loading categories...</option>
              )}
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                No categories yet — <Link href="/dashboard/categories" className="underline">create one first</Link>
              </p>
            )}
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
                    value={attributes.dynamicFields[field.key] || ''}
                    onChange={e => setAttributes(prev => ({
                      ...prev,
                      dynamicFields: { ...prev.dynamicFields, [field.key]: e.target.value }
                    }))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Pricing ──────────────────────────────────────────────────────── */}
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
                onChange={e => setForm({ ...form, price: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Original / Was Price</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                placeholder="200.00 (optional)"
                value={form.compareAtPrice}
                onChange={e => setForm({ ...form, compareAtPrice: e.target.value })}
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">Shows crossed-out price if higher than sale price.</p>
            </div>
          </div>
        </div>

        {/* ── Stock & Inventory ─────────────────────────────────────────────── */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-[var(--text-primary)]">Stock & Inventory</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Product Code (SKU)</label>
              <input
                className="input"
                placeholder="e.g. IPH-CASE-001"
                value={form.sku}
                onChange={e => setForm({ ...form, sku: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Available Quantity</label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.stockQuantity}
                onChange={e => setForm({ ...form, stockQuantity: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-[var(--brand)]"
                checked={form.trackInventory}
                onChange={e => setForm({ ...form, trackInventory: e.target.checked })}
              />
              <span className="text-sm text-[var(--text-primary)]">Automatically stop selling when stock runs out</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-[var(--brand)]"
                checked={form.allowBackorder}
                onChange={e => setForm({ ...form, allowBackorder: e.target.checked })}
              />
              <span className="text-sm text-[var(--text-primary)]">Allow orders even when out of stock</span>
            </label>
          </div>
        </div>

        {/* ── Product Showcase Type ─────────────────────────────────────────── */}
        <div className="card p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Tag className="w-4 h-4 text-[var(--brand)]" />
              Storefront Showcase
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">How should this product be featured? Pick one label.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DISPLAY_TYPES.map(({ value, label, desc }) => {
              const isActive = form.tags.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setForm(f => ({
                      ...f,
                      tags: isActive
                        ? f.tags.filter(t => t !== value)
                        : [...f.tags.filter(t => !DISPLAY_TYPES.map(d => d.value).includes(t)), value],
                    }))
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

        {/* ── Product Attributes (Colors, Sizes, Custom) ───────────────────── */}
        <div className="card p-5 space-y-5">
          <div>
            <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Palette className="w-4 h-4 text-[var(--brand)]" />
              Product Options & Attributes
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">Colors, sizes, and any other options customers need to choose from.</p>
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
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newColorName) {
                      setAttributes(prev => ({ ...prev, colors: [...prev.colors, { name: newColorName, hex: newColorHex }] }));
                      setNewColorName('');
                      setNewColorHex('#000000');
                    }
                  }
                }}
              />
              <input
                type="color"
                className="w-12 h-10 rounded border cursor-pointer"
                value={newColorHex}
                onChange={e => setNewColorHex(e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  if (newColorName) {
                    setAttributes(prev => ({ ...prev, colors: [...prev.colors, { name: newColorName, hex: newColorHex }] }));
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
                    <span className="w-3.5 h-3.5 rounded-full border" style={{ backgroundColor: color.hex }} />
                    {color.name}
                    <button type="button" onClick={() => setAttributes(prev => ({ ...prev, colors: prev.colors.filter((_, i) => i !== idx) }))} className="hover:text-red-500">
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
              <Ruler className="w-3.5 h-3.5" />
              {activeTemplate === 'RESTAURANT' ? 'Portion Sizes' : 'Available Sizes'}
            </label>

            {/* Size Presets */}
            {currentTemplate?.sizePresets && currentTemplate.sizePresets.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentTemplate.sizePresets.map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      if (!attributes.sizes.includes(size)) {
                        setAttributes(prev => ({ ...prev, sizes: [...prev.sizes, size] }));
                      }
                    }}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                      attributes.sizes.includes(size)
                        ? 'border-[var(--brand)] bg-[var(--brand)]/[0.08] text-[var(--brand)]'
                        : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)]'
                    }`}
                  >
                    {attributes.sizes.includes(size) ? '✓ ' : '+ '}{size}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Custom size (press Enter to add)"
                value={newSize}
                onChange={e => setNewSize(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newSize) {
                    e.preventDefault();
                    setAttributes(prev => ({ ...prev, sizes: [...prev.sizes, newSize] }));
                    setNewSize('');
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (newSize) { setAttributes(prev => ({ ...prev, sizes: [...prev.sizes, newSize] })); setNewSize(''); }
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
                    <button type="button" onClick={() => setAttributes(prev => ({ ...prev, sizes: prev.sizes.filter((_, i) => i !== idx) }))} className="hover:text-red-500">
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
                placeholder="Group name (e.g. Spice Level)"
                value={newCustomAttrName}
                onChange={e => setNewCustomAttrName(e.target.value)}
              />
              <input
                className="input"
                placeholder="Value (e.g. Mild)"
                value={newCustomAttrValue}
                onChange={e => setNewCustomAttrValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newCustomAttrName && newCustomAttrValue) {
                    e.preventDefault();
                    const existing = attributes.customAttributes.find(a => a.name === newCustomAttrName);
                    if (existing) {
                      setAttributes(prev => ({ ...prev, customAttributes: prev.customAttributes.map(a => a.name === newCustomAttrName ? { ...a, values: [...a.values, newCustomAttrValue] } : a) }));
                    } else {
                      setAttributes(prev => ({ ...prev, customAttributes: [...prev.customAttributes, { name: newCustomAttrName, values: [newCustomAttrValue] }] }));
                    }
                    setNewCustomAttrValue('');
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (newCustomAttrName && newCustomAttrValue) {
                  const existing = attributes.customAttributes.find(a => a.name === newCustomAttrName);
                  if (existing) {
                    setAttributes(prev => ({ ...prev, customAttributes: prev.customAttributes.map(a => a.name === newCustomAttrName ? { ...a, values: [...a.values, newCustomAttrValue] } : a) }));
                  } else {
                    setAttributes(prev => ({ ...prev, customAttributes: [...prev.customAttributes, { name: newCustomAttrName, values: [newCustomAttrValue] }] }));
                  }
                  setNewCustomAttrValue('');
                }
              }}
              className="btn-secondary text-xs"
            >
              Add Value
            </button>
            {attributes.customAttributes.map((attr, idx) => (
              <div key={idx} className="bg-slate-50 p-3 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">{attr.name}</span>
                  <button type="button" onClick={() => setAttributes(prev => ({ ...prev, customAttributes: prev.customAttributes.filter((_, i) => i !== idx) }))} className="text-red-500">
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
        </div>

        {/* ── Images ──────────────────────────────────────────────────────── */}
        <div className="card p-5 space-y-3">
          <div>
            <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[var(--brand)]" />
              Product Images
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">Drag & drop to upload multiple photos. First image becomes the main thumbnail.</p>
          </div>
          <ImageUploader
            images={form.images}
            onChange={imgs => setForm(f => ({ ...f, images: imgs }))}
          />
        </div>

        {/* ── Submit Actions ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pb-8">
          <button type="submit" disabled={isLoading} className="btn-secondary">
            {isLoading ? <Spinner size="sm" /> : 'Save as Draft'}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={e => handleSubmit(e as any, true)}
            className="btn-primary"
          >
            {isLoading ? <Spinner size="sm" /> : '⚡ Publish Product'}
          </button>
        </div>

      </form>
    </div>
  );
}
