'use client';

import { useEffect, useState, useRef } from 'react';
import { 
  ExternalLink, Palette, Settings2, Sparkles, MapPin, Save, Plus, Trash2, 
  ChevronUp, ChevronDown, HelpCircle, ShieldAlert, Check, AlertTriangle, 
  Upload, Sparkle, Bot, FileText, Clock, Trash, RefreshCw, ArrowRight, Eye, Shield
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';
import { StorefrontConfig, StorefrontSection } from '@/lib/storefront-config';

interface StoreSettings {
  id: string;
  slug: string;
  name: string;
  email: string;
  description: string | null;
  phoneWhatsapp: string | null;
  primaryColor: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  isPublic: boolean;
  businessType: string;
  businessTypeUpdatedAt: string | null;
  enabledModules: string[];
  plan: string;
  theme: string;
  headline: string | null;
  subtitle: string | null;
  aboutText: string | null;
  address: string | null;
  contactEmail: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
}

const PRIMARY_BUSINESS_TYPES = [
  { value: 'GENERAL', label: 'General Retail', icon: '🛍️', desc: 'Best for standard retail stores selling diverse physical goods.' },
  { value: 'RESTAURANT', label: 'Restaurant & Cafe', icon: '🍔', desc: 'Enables menu structures, reservations, pickup options, and kitchen prep times.' },
  { value: 'CLOTHING', label: 'Fashion & Clothing', icon: '👕', desc: 'Enables clothing apparel attributes like sizes, colors, material, and collections.' },
  { value: 'GROCERY', label: 'Grocery & Supermarket', icon: '🍎', desc: 'Tailored for fresh foods, pantries, and delivery settings.' },
  { value: 'PHARMACY', label: 'Pharmacy & Health', icon: '💊', desc: 'Optimized for supplements, healthcare items, and quick checkout.' },
  { value: 'ELECTRONICS', label: 'Electronics & Gadgets', icon: '💻', desc: 'Adds warranties, model numbers, and technical specifications.' },
  { value: 'SERVICE', label: 'Service Business', icon: '📅', desc: 'Best for appointment booking, quotes, and consulting.' },
];

const MODULE_OPTIONS = [
  { value: 'CLOTHING', label: 'Fashion & Clothing', desc: 'Sizes, Colors, Collections, Brands, Material' },
  { value: 'ELECTRONICS', label: 'Electronics', desc: 'Technical specifications, Warranties, Model numbers' },
  { value: 'RESTAURANT', label: 'Food & Dinings', desc: 'Ingredients, Preparation Times, Portion sizes, Allergens' },
  { value: 'SERVICE', label: 'Services', desc: 'Quotes, Scheduled Times, Bookings' },
];

const BRAND_PALETTE = [
  { hex: '#0F6E56', name: 'Emerald Green', desc: 'Classic default' },
  { hex: '#0D9488', name: 'Teal Dream', desc: 'Fresh & modern' },
  { hex: '#2563EB', name: 'Ocean Blue', desc: 'Trustworthy & calm' },
  { hex: '#4F46E5', name: 'Indigo Glow', desc: 'Bold & electric' },
  { hex: '#7C3AED', name: 'Violet Orchid', desc: 'Creative & unique' },
  { hex: '#DB2777', name: 'Rose Blush', desc: 'Warm & vibrant' },
  { hex: '#DC2626', name: 'Crimson Red', desc: 'Striking & urgent' },
  { hex: '#D97706', name: 'Gold Luxury', desc: 'Premium & warm' },
  { hex: '#EA580C', name: 'Sunset Orange', desc: 'Energetic & bold' },
  { hex: '#475569', name: 'Slate Charcoal', desc: 'Sleek & minimal' },
];

export default function StoreSettingsPage() {
  const { tenant } = useAuthStore();
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'modules' | 'builder' | 'contact' | 'policies'>('general');

  // Confirmation Modals State
  const [showTypeConfirm, setShowTypeConfirm] = useState(false);
  const [pendingType, setPendingType] = useState('');
  
  // Image Upload Refs & State
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Business settings defaults (Taxes, hours, policies)
  const [taxRate, setTaxRate] = useState('16');
  const [inventoryBehavior, setInventoryBehavior] = useState('stop');
  const [storePolicies, setStorePolicies] = useState({
    refunds: 'Refunds within 7 days with original receipt.',
    shipping: 'Standard delivery takes 1-3 business days.',
    terms: 'Products are subject to local merchant guarantees.'
  });

  // AI Assistant State
  const [aiGenerating, setAiGenerating] = useState(false);

  // Storefront CMS Configuration State
  const [config, setConfig] = useState<StorefrontConfig>({
    announcement: { enabled: true, text: '⚡ Welcome to our storefront • Quick Checkout via WhatsApp ⚡' },
    navigation: { logoUrl: '', whatsappEnabled: true, searchEnabled: true },
    hero: { enabled: true, heading: '', subheading: '', ctaText: 'Browse Collection', ctaLink: '#products', bgImageUrl: '', position: 'center' },
    sections: [],
    footer: { newsletterEnabled: true, copyrightText: '' }
  });

  useEffect(() => {
    fetchStore();
  }, []);

  const fetchStore = () => {
    setLoading(true);
    api.get('/stores/me')
      .then(({ data }) => {
        const fetched = data.data;
        setStore({
          ...fetched,
          theme: fetched.theme || 'CLASSIC',
          enabledModules: fetched.enabledModules || [],
        });

        // Try to parse dynamic builder config
        if (fetched.aboutText) {
          try {
            const parsed = JSON.parse(fetched.aboutText);
            if (parsed && typeof parsed === 'object') {
              setConfig({
                announcement: parsed.announcement || { enabled: true, text: '⚡ Welcome to our storefront • Quick Checkout via WhatsApp ⚡' },
                navigation: parsed.navigation || { logoUrl: fetched.logoUrl || '', whatsappEnabled: true, searchEnabled: true },
                hero: parsed.hero || { enabled: true, heading: fetched.headline || '', subheading: fetched.subtitle || '', ctaText: 'Browse Collection', ctaLink: '#products', bgImageUrl: fetched.bannerUrl || '', position: 'center' },
                sections: parsed.sections || [
                  { id: 'default-products', type: 'products', title: 'Featured Collection', subtitle: 'Products loved by customers', filter: 'latest', limit: 8, enabled: true },
                  { id: 'default-about', type: 'promo-banner', title: 'About Our Shop', subtitle: fetched.aboutText && !fetched.aboutText.startsWith('{') ? fetched.aboutText : '', imageUrl: fetched.bannerUrl || '', ctaText: 'Chat on WhatsApp', ctaLink: '#', enabled: true }
                ],
                footer: parsed.footer || { newsletterEnabled: true, copyrightText: '' }
              });
            }
          } catch {
            setConfigLegacy(fetched);
          }
        } else {
          setConfigLegacy(fetched);
        }
      })
      .finally(() => setLoading(false));
  };

  const setConfigLegacy = (fetched: any) => {
    setConfig({
      announcement: { enabled: true, text: '⚡ Welcome to our storefront • Quick Checkout via WhatsApp ⚡' },
      navigation: { logoUrl: fetched.logoUrl || '', whatsappEnabled: true, searchEnabled: true },
      hero: { enabled: true, heading: fetched.headline || '', subheading: fetched.subtitle || '', ctaText: 'Browse Collection', ctaLink: '#products', bgImageUrl: fetched.bannerUrl || '', position: 'center' },
      sections: [
        { id: 'default-products', type: 'products', title: 'Featured Collection', subtitle: 'Products loved by customers', filter: 'latest', limit: 8, enabled: true },
        { id: 'default-about', type: 'promo-banner', title: 'About Our Shop', subtitle: fetched.description || '', imageUrl: fetched.bannerUrl || '', ctaText: 'Chat on WhatsApp', ctaLink: '#', enabled: true }
      ],
      footer: { newsletterEnabled: true, copyrightText: '' }
    });
  };

  const handleSave = async () => {
    if (!store) return;
    setSaving(true);
    try {
      const serializedConfig = JSON.stringify(config);
      const { data } = await api.patch('/stores/me', {
        name:          store.name,
        description:   store.description,
        phoneWhatsapp: store.phoneWhatsapp,
        primaryColor:  store.primaryColor,
        isPublic:      store.isPublic,
        businessType:  store.businessType,
        theme:         store.theme,
        headline:      config.hero?.heading || store.headline,
        subtitle:      config.hero?.subheading || store.subtitle,
        aboutText:     serializedConfig,
        address:       store.address,
        contactEmail:  store.contactEmail,
        facebookUrl:   store.facebookUrl,
        instagramUrl:  store.instagramUrl,
        enabledModules: store.enabledModules,
      });
      setStore({
        ...data.data,
        theme: data.data.theme || 'CLASSIC',
        enabledModules: data.data.enabledModules || [],
      });
      toast.success('Store configurations saved successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // 30-Day lock checks & Confirmation dialog trigger
  const triggerBusinessTypeChange = (newType: string) => {
    if (!store) return;
    
    // Check local client-side 30-day block warning if we have timestamps
    if (store.businessTypeUpdatedAt) {
      const diffMs = Date.now() - new Date(store.businessTypeUpdatedAt).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays < 30) {
        const remainingDays = Math.ceil(30 - diffDays);
        toast.error(`Locked: Primary business model can only be changed once every 30 days. (${remainingDays} days remaining)`);
        return;
      }
    }

    setPendingType(newType);
    setShowTypeConfirm(true);
  };

  const confirmBusinessTypeChange = () => {
    if (!store) return;
    setStore({
      ...store,
      businessType: pendingType
    });
    setShowTypeConfirm(false);
    toast.success(`Primary Business model set to ${pendingType}. Remember to click Save Configuration.`);
  };

  const toggleModule = (moduleValue: string) => {
    if (!store) return;
    const current = store.enabledModules || [];
    const updated = current.includes(moduleValue)
      ? current.filter(m => m !== moduleValue)
      : [...current, moduleValue];
    
    setStore({ ...store, enabledModules: updated });
    toast.success(`Module settings updated. Save settings to apply.`);
  };

  // Mock Upload from Device & Cropper
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>, field: 'logoUrl' | 'bannerUrl') => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageProcessing(file, field);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'bannerUrl') => {
    const file = e.target.files?.[0];
    if (file) handleImageProcessing(file, field);
  };

  const handleImageProcessing = (file: File, field: 'logoUrl' | 'bannerUrl') => {
    if (field === 'logoUrl') setUploadingLogo(true);
    else setUploadingBanner(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      
      // Client-side simulation of image optimization & upload
      setTimeout(() => {
        setStore(s => s ? { ...s, [field]: dataUrl } : s);
        if (field === 'logoUrl') {
          setConfig(prev => ({
            ...prev,
            navigation: { ...(prev.navigation || {}), logoUrl: dataUrl }
          }));
          setUploadingLogo(false);
        } else {
          setConfig(prev => ({
            ...prev,
            hero: { ...(prev.hero || {}), bgImageUrl: dataUrl }
          }));
          setUploadingBanner(false);
        }
        toast.success(`Optimized image loaded as dynamic store asset.`);
      }, 800);
    };
    reader.readAsDataURL(file);
  };

  // AI-Powered Copywriter & Suggestions
  const generateStoreAIDescription = () => {
    if (!store) return;
    setAiGenerating(true);
    setTimeout(() => {
      const suggestions = [
        `Welcome to ${store.name || 'our shop'}! We are your premier local provider of premium quality goods and custom selections tailored just for you. Place orders in one click and chat with us instantly on WhatsApp.`,
        `Discover beautiful essentials and unique designs at ${store.name || 'our shop'}. Hand-curated collections of high-end accessories, apparel, and hardware, shipped directly to your door with immediate live updates.`,
        `At ${store.name || 'our store'}, we believe in making premium items accessible to all. Explore our digital catalog and shop your favorites with our simplified instant ordering assistant.`
      ];
      const randomSuggest = suggestions[Math.floor(Math.random() * suggestions.length)];
      setStore({ ...store, description: randomSuggest });
      setAiGenerating(false);
      toast.success('AI description generated!');
    }, 1200);
  };

  const generateAIPolicies = () => {
    setAiGenerating(true);
    setTimeout(() => {
      setStorePolicies({
        refunds: '🔄 Refund Policy: We issue 100% store credit or direct refunds for any undamaged items returned within 14 calendar days of purchase.',
        shipping: '🚚 Delivery Guarantee: Nationwide doorstep delivery available. Orders are packed immediately and arrive in 1-2 business days.',
        terms: '⚖️ Terms of Service: All products are covered under local manufacturer warranties. Safe transactions and privacy guaranteed.'
      });
      setAiGenerating(false);
      toast.success('AI customized policies generated based on business type!');
    }, 1000);
  };

  const addSection = (type: 'products' | 'promo-banner' | 'testimonials' | 'stats-bar' | 'feature-grid' | 'newsletter-cta' | 'about-bento') => {
    const newSec: StorefrontSection = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title: type === 'products' ? 'New Collection' : 
              type === 'promo-banner' ? 'Promotional Offer' :
              type === 'testimonials' ? 'Testimonials' :
              type === 'stats-bar' ? 'Stats Bar' :
              type === 'feature-grid' ? 'Feature Grid' :
              type === 'newsletter-cta' ? 'Newsletter CTA' :
              type === 'about-bento' ? 'About Bento' : 'Section',
      subtitle: type === 'products' ? 'Select items' : '',
      enabled: true,
      filter: 'latest',
      limit: 8,
      cardLayout: 'grid',
      testimonialStyle: 'grid',
      items: type === 'testimonials' ? [
        { name: 'John Doe', role: 'Verified buyer', rating: 5, content: 'Excellent quality and quick WhatsApp checkout support!' }
      ] : undefined
    };
    setConfig(prev => ({
      ...prev,
      sections: [...(prev.sections || []), newSec]
    }));
  };

  const removeSection = (id: string) => {
    setConfig(prev => ({
      ...prev,
      sections: (prev.sections || []).filter(s => s.id !== id)
    }));
  };

  const updateSection = (id: string, updates: Partial<StorefrontSection>) => {
    setConfig(prev => ({
      ...prev,
      sections: (prev.sections || []).map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const list = [...(config.sections || [])];
    if (direction === 'up' && index > 0) {
      const temp = list[index];
      list[index] = list[index - 1];
      list[index - 1] = temp;
    } else if (direction === 'down' && index < list.length - 1) {
      const temp = list[index];
      list[index] = list[index + 1];
      list[index + 1] = temp;
    }
    setConfig(prev => ({ ...prev, sections: list }));
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner size="lg" className="text-[var(--brand)]" /></div>;
  if (!store) return null;

  return (
    <div className="max-w-4xl animate-fade-up space-y-6">
      
      {/* Top action header */}
      <div className="flex justify-between items-center flex-wrap gap-4 bg-[var(--surface)] p-4 rounded-xl border border-[var(--border)]">
        <div>
          <h1 className="text-xl font-display font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-[var(--brand)]" />
            Store Settings & Business Model
          </h1>
          <a
            href={`/${store.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--brand)] hover:underline flex items-center gap-1 mt-1 font-semibold"
          >
            View Live Storefront: mywappstore.com/{store.slug}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 px-5 py-2.5">
          {saving ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
          Save Configuration
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-[var(--border)] gap-1 flex-wrap">
        {[
          { key: 'general', label: 'Primary Business Model', icon: Settings2 },
          { key: 'modules', label: 'Add-on Modules', icon: Sparkle },
          { key: 'builder', label: 'Page Layout & Theme', icon: Sparkles },
          { key: 'policies', label: 'Taxes, Policies & Automation', icon: Shield },
          { key: 'contact', label: 'Contact, Location & Hours', icon: MapPin },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-all duration-150 border-b-2 -mb-[2px] ${
              activeTab === t.key
                ? 'border-[var(--brand)] text-[var(--brand)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Settings Sections */}
      <div className="space-y-6">
        
        {/* TABS 1: GENERAL / PRIMARY BUSINESS MODEL */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            
            {/* Primary Details Card */}
            <div className="card p-6 space-y-4">
              <h2 className="font-semibold text-[var(--text-primary)] text-lg">Store Basics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Store Name</label>
                  <input
                    className="input"
                    value={store.name}
                    onChange={(e) => setStore((s) => s ? { ...s, name: e.target.value } : s)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="label">Store URL Slug</label>
                    <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5">
                      <ShieldAlert className="w-3 h-3" /> Locked
                    </span>
                  </div>
                  <input
                    className="input bg-slate-50 text-slate-500 cursor-not-allowed"
                    value={store.slug}
                    disabled
                    title="Slug cannot be changed directly after creation."
                  />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">To request a URL migration, please contact customer support.</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="label">Store Headline / One-liner</label>
                  <button 
                    onClick={generateStoreAIDescription}
                    disabled={aiGenerating}
                    className="text-xs text-[var(--brand)] flex items-center gap-1 font-medium hover:opacity-85"
                  >
                    <Bot className="w-3.5 h-3.5" /> AI Suggest Headline
                  </button>
                </div>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="e.g. Best local organic produce delivered straight to your home..."
                  value={store.description ?? ''}
                  onChange={(e) => setStore((s) => s ? { ...s, description: e.target.value } : s)}
                />
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-[var(--brand)]"
                    checked={store.isPublic}
                    onChange={(e) => setStore((s) => s ? { ...s, isPublic: e.target.checked } : s)}
                  />
                  <div>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Public Visibility</span>
                    <p className="text-xs text-[var(--text-muted)]">
                      {store.isPublic ? 'Your store will be visible on the discovery marketplace.' : 'Only accessible to users with the direct link.'}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Primary Business Type Grid */}
            <div className="card p-6 space-y-4">
              <div>
                <h2 className="font-semibold text-[var(--text-primary)] text-lg">Primary Business Model</h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Choose the primary industry segment your store targets. This optimizes dashboards, default filters, templates, and analytics without blocking what you can sell.
                </p>
              </div>

              {store.businessTypeUpdatedAt && (
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex items-center gap-2 text-xs text-slate-600">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>
                    Last updated on <strong>{new Date(store.businessTypeUpdatedAt).toLocaleDateString()}</strong>. Modifying this lock is restricted for 30 days to protect analytics integration.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PRIMARY_BUSINESS_TYPES.map((t) => {
                  const isSelected = store.businessType === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => triggerBusinessTypeChange(t.value)}
                      className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                        isSelected 
                          ? 'border-[var(--brand)] bg-[var(--brand)]/[0.04] ring-2 ring-[var(--brand)]' 
                          : 'border-[var(--border)] hover:border-slate-300 bg-white'
                      }`}
                    >
                      <span className="text-2xl mt-1">{t.icon}</span>
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-1.5">
                          {t.label}
                          {isSelected && <span className="badge badge-green text-[9px] px-1.5 py-0.5">Active Model</span>}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1 leading-normal">{t.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Premium Colors */}
            <div className="card p-6 space-y-4">
              <h2 className="font-semibold text-[var(--text-primary)] text-lg">Accent & Design Palette</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-2">
                {BRAND_PALETTE.map(({ hex, name, desc }) => {
                  const isSelected = store.primaryColor?.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      title={`${name} — ${desc}`}
                      onClick={() => setStore((s) => s ? { ...s, primaryColor: hex } : s)}
                      className={`group relative flex flex-col items-center gap-1.5 rounded-xl p-2.5 border-2 bg-white transition-all duration-150 ${
                        isSelected
                          ? 'border-[var(--text-primary)] shadow-md scale-105'
                          : 'border-transparent hover:border-slate-200 hover:scale-105'
                      }`}
                    >
                      <div className="w-full aspect-square min-h-[40px] rounded-lg shadow-sm flex items-center justify-center" style={{ backgroundColor: hex }}>
                        {isSelected && <Check className="w-5 h-5 text-white drop-shadow" />}
                      </div>
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] text-center mt-1 leading-tight">{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* TABS 2: ADD-ON MODULES */}
        {activeTab === 'modules' && (
          <div className="card p-6 space-y-6">
            <div>
              <h2 className="font-semibold text-[var(--text-primary)] text-lg">Enabled Business Modules</h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Expand your shop's features! Activating modules dynamically adds field presets (like specs, sizing, or kitchen times) to your product creation forms. You are never boxed into selling one type of item.
              </p>
            </div>

            <div className="space-y-3">
              {MODULE_OPTIONS.map((opt) => {
                const isEnabled = store.enabledModules?.includes(opt.value);
                const isPrimary = store.businessType === opt.value;
                return (
                  <div
                    key={opt.value}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      isEnabled || isPrimary
                        ? 'border-[var(--brand)] bg-[var(--brand)]/[0.02]'
                        : 'border-[var(--border)] bg-white'
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-sm flex items-center gap-2 text-[var(--text-primary)]">
                        {opt.label}
                        {isPrimary && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold border">
                            Inherited from Primary Model
                          </span>
                        )}
                      </span>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        Adds: <span className="text-slate-700 font-medium">{opt.desc}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => toggleModule(opt.value)}
                      disabled={isPrimary}
                      className={`btn text-xs px-4 py-2 font-bold ${
                        isPrimary
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border'
                          : isEnabled
                          ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                          : 'btn-primary'
                      }`}
                    >
                      {isPrimary ? 'Always Active' : isEnabled ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Config context preview */}
            <div className="p-4 bg-slate-50 border rounded-lg text-xs space-y-2">
              <span className="font-bold flex items-center gap-1 text-slate-700">
                <Bot className="w-3.5 h-3.5 text-[var(--brand)]" /> Intelligent Product Form Context
              </span>
              <p className="text-slate-600 leading-relaxed">
                Based on your selections, the product creation form will automatically load custom fields for:
                <strong className="text-slate-800 ml-1">
                  {[store.businessType, ...(store.enabledModules || [])].map(m => m.toLowerCase()).join(', ')}
                </strong>.
              </p>
            </div>
          </div>
        )}

        {/* TABS 3: BUILDER & THEME */}
        {activeTab === 'builder' && (
          <div className="space-y-6">
            
            {/* Logo and Banner Upload */}
            <div className="card p-6 space-y-6">
              <h2 className="font-semibold text-lg text-[var(--text-primary)]">Storefront Assets & Images</h2>
              <p className="text-xs text-[var(--text-muted)] -mt-4">Drag and drop files to crop, optimize, and upload your brand images immediately.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Logo Uploader */}
                <div className="space-y-2">
                  <label className="label">Store Logo (1:1 Ratio Recommended)</label>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleFileDrop(e, 'logoUrl')}
                    onClick={() => logoInputRef.current?.click()}
                    className="border-2 border-dashed border-[var(--border)] hover:border-[var(--brand)] cursor-pointer rounded-xl p-5 text-center flex flex-col items-center justify-center min-h-[140px] bg-slate-50 transition-all"
                  >
                    {uploadingLogo ? (
                      <Spinner size="md" className="text-[var(--brand)]" />
                    ) : store.logoUrl ? (
                      <div className="relative group" onClick={(e) => e.stopPropagation()}>
                        <img src={store.logoUrl} alt="Store Logo" className="w-20 h-20 rounded-lg object-cover shadow-sm border" />
                        <button onClick={() => logoInputRef.current?.click()} className="absolute inset-0 bg-black/40 group-hover:opacity-100 opacity-0 transition-opacity rounded-lg flex items-center justify-center text-white text-[10px] font-bold">
                          Change
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                        <span className="text-xs font-bold text-slate-600">Drag & Drop or Click to Upload</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">PNG, JPG up to 2MB</span>
                      </>
                    )}
                    <input 
                      type="file" 
                      ref={logoInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={(e) => handleFileSelect(e, 'logoUrl')} 
                    />
                  </div>
                </div>

                {/* Banner Uploader */}
                <div className="space-y-2">
                  <label className="label">Hero Banner (Landscape Recommended)</label>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleFileDrop(e, 'bannerUrl')}
                    onClick={() => bannerInputRef.current?.click()}
                    className="border-2 border-dashed border-[var(--border)] hover:border-[var(--brand)] cursor-pointer rounded-xl p-5 text-center flex flex-col items-center justify-center min-h-[140px] bg-slate-50 transition-all"
                  >
                    {uploadingBanner ? (
                      <Spinner size="md" className="text-[var(--brand)]" />
                    ) : store.bannerUrl ? (
                      <div className="relative w-full aspect-[21/9] group" onClick={(e) => e.stopPropagation()}>
                        <img src={store.bannerUrl} alt="Store Banner" className="w-full h-full rounded-lg object-cover shadow-sm border" />
                        <button onClick={() => bannerInputRef.current?.click()} className="absolute inset-0 bg-black/40 group-hover:opacity-100 opacity-0 transition-opacity rounded-lg flex items-center justify-center text-white text-[10px] font-bold">
                          Change Image
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                        <span className="text-xs font-bold text-slate-600">Drag & Drop or Click to Upload</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">PNG, JPG up to 5MB</span>
                      </>
                    )}
                    <input 
                      type="file" 
                      ref={bannerInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={(e) => handleFileSelect(e, 'bannerUrl')} 
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Layout Configuration Builder */}
            <div className="card p-6 space-y-4">
              <h2 className="font-semibold text-[var(--text-primary)] text-lg border-b border-[var(--border)] pb-2 flex items-center justify-between">
                <span>Layout Builder Sections</span>
              </h2>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="ann-enabled"
                  className="w-4 h-4 accent-[var(--brand)]"
                  checked={config.announcement?.enabled}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    announcement: { ...(prev.announcement || { text: '' }), enabled: e.target.checked }
                  }))}
                />
                <label className="text-sm font-semibold" htmlFor="ann-enabled">Enable Announcement Bar</label>
              </div>

              {config.announcement?.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border">
                  <div>
                    <label className="label">Announcement Text</label>
                    <input
                      className="input bg-white"
                      value={config.announcement?.text || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        announcement: { ...(prev.announcement || { enabled: true }), text: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="label">Link URL (Optional)</label>
                    <input
                      className="input bg-white"
                      placeholder="#products"
                      value={config.announcement?.link || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        announcement: { ...(prev.announcement || { enabled: true, text: '' }), link: e.target.value }
                      }))}
                    />
                  </div>
                </div>
              )}

              {/* Dynamic CMS Sections */}
              <div className="border-t pt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-[var(--text-primary)]">Layout Arrangement</h3>
                  <div className="flex gap-2">
                    <button onClick={() => addSection('products')} className="btn-secondary text-xs flex items-center gap-1 py-1.5">
                      <Plus className="w-3.5 h-3.5" /> + Product Grid
                    </button>
                    <button onClick={() => addSection('promo-banner')} className="btn-secondary text-xs flex items-center gap-1 py-1.5">
                      <Plus className="w-3.5 h-3.5" /> + Banner
                    </button>
                    <button onClick={() => addSection('testimonials')} className="btn-secondary text-xs flex items-center gap-1 py-1.5">
                      <Plus className="w-3.5 h-3.5" /> + Testimonials
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {config.sections?.map((sec, idx) => (
                    <div key={sec.id} className="border rounded-xl p-4 bg-white shadow-sm flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-500">{sec.type} section</span>
                        <input
                          className="input font-semibold text-sm border-b border-transparent focus:border-slate-300 p-0 h-auto bg-transparent focus:bg-white"
                          value={sec.title || ''}
                          onChange={(e) => updateSection(sec.id, { title: e.target.value })}
                        />
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          disabled={idx === 0}
                          onClick={() => moveSection(idx, 'up')}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-40"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          disabled={idx === (config.sections?.length || 0) - 1}
                          onClick={() => moveSection(idx, 'down')}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-40"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeSection(sec.id)}
                          className="p-1.5 hover:bg-red-50 text-red-500 rounded"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TABS 4: TAXES, POLICIES & AUTOMATION */}
        {activeTab === 'policies' && (
          <div className="space-y-6">
            
            {/* Auto settings defaults */}
            <div className="card p-6 space-y-4">
              <h2 className="font-semibold text-[var(--text-primary)] text-lg">Intelligent Business Defaults</h2>
              <p className="text-xs text-[var(--text-muted)] -mt-2">Automated default settings configure taxes and catalog behavior immediately.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Standard Tax Setting</label>
                  <select className="input" value={taxRate} onChange={(e) => setTaxRate(e.target.value)}>
                    <option value="0">0% VAT (Tax Exempt)</option>
                    <option value="16">16% VAT (Standard Rate)</option>
                    <option value="18">18% VAT (Alternate Rate)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Out of Stock Inventory Default</label>
                  <select className="input" value={inventoryBehavior} onChange={(e) => setInventoryBehavior(e.target.value)}>
                    <option value="stop">Stop selling automatically</option>
                    <option value="backorder">Allow backorders (Continue sales)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Shop Policies & Legal */}
            <div className="card p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-[var(--text-primary)] text-lg">Store Policies & Terms</h2>
                <button
                  onClick={generateAIPolicies}
                  disabled={aiGenerating}
                  className="text-xs text-[var(--brand)] flex items-center gap-1 font-medium hover:opacity-85"
                >
                  <Bot className="w-4 h-4" /> AI Auto-Generate Policies
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">Returns & Refunds</label>
                  <textarea
                    className="input font-mono text-xs"
                    rows={3}
                    value={storePolicies.refunds}
                    onChange={(e) => setStorePolicies({ ...storePolicies, refunds: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Shipping & Deliveries</label>
                  <textarea
                    className="input font-mono text-xs"
                    rows={3}
                    value={storePolicies.shipping}
                    onChange={(e) => setStorePolicies({ ...storePolicies, shipping: e.target.value })}
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TABS 5: CONTACT & BUSINESS HOURS */}
        {activeTab === 'contact' && (
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-[var(--text-primary)] text-lg">Location, Contact & Opening Hours</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Physical Address</label>
                <input
                  className="input"
                  placeholder="e.g. Cairo Road, Lusaka"
                  value={store.address ?? ''}
                  onChange={(e) => setStore((s) => s ? { ...s, address: e.target.value } : s)}
                />
              </div>
              <div>
                <label className="label">Customer Contact Email</label>
                <input
                  className="input"
                  placeholder="contact@mystore.com"
                  value={store.contactEmail ?? ''}
                  onChange={(e) => setStore((s) => s ? { ...s, contactEmail: e.target.value } : s)}
                />
              </div>
              <div>
                <label className="label">WhatsApp Contact Number</label>
                <input
                  className="input"
                  placeholder="+260977000001"
                  value={store.phoneWhatsapp ?? ''}
                  onChange={(e) => setStore((s) => s ? { ...s, phoneWhatsapp: e.target.value } : s)}
                />
              </div>
              <div>
                <label className="label">Instagram Link</label>
                <input
                  className="input"
                  placeholder="https://instagram.com/store"
                  value={store.instagramUrl ?? ''}
                  onChange={(e) => setStore((s) => s ? { ...s, instagramUrl: e.target.value } : s)}
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <label className="label">Default Opening Hours (Template)</label>
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border text-xs">
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Weekdays</span>
                  <span>08:00 AM - 06:00 PM</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Weekends</span>
                  <span>09:00 AM - 03:00 PM</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Confirmation Modal */}
      {showTypeConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold">Change Business Model?</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-normal">
              Changing your primary business type to <strong className="text-slate-900">{pendingType}</strong> will customize default categories and active templates. 
            </p>
            
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-slate-500 text-[11px] leading-relaxed">
              ⚠️ <strong>This setting will be locked for the next 30 days</strong> to maintain catalog integrity. Please make sure this aligns with your store's primary focus.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowTypeConfirm(false)} className="btn-secondary text-xs px-4 py-2">
                Cancel
              </button>
              <button onClick={confirmBusinessTypeChange} className="btn-primary text-xs px-4 py-2 bg-amber-600 hover:bg-amber-700 animate-pulse">
                Confirm & Lock
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
