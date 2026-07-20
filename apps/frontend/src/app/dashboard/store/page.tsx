'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Palette, Settings2, Sparkles, MapPin, Save, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
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

const BUSINESS_TYPES = [
  { value: 'GENERAL',   label: 'General Store' },
  { value: 'RESTAURANT', label: 'Restaurant / Food' },
  { value: 'RETAIL',    label: 'Retail Shop' },
  { value: 'GROCERY',   label: 'Grocery / Supermarket' },
  { value: 'PHARMACY',  label: 'Pharmacy / Health' },
  { value: 'SERVICE',   label: 'Service Provider' },
];

const THEME_OPTIONS = [
  { value: 'CLASSIC', label: 'Classic Premium Unified Layout' },
];

const BRAND_PALETTE = [
  { hex: '#0F6E56', name: 'Emerald Green',    desc: 'Classic default' },
  { hex: '#0D9488', name: 'Teal Dream',        desc: 'Fresh & modern' },
  { hex: '#2563EB', name: 'Ocean Blue',        desc: 'Trustworthy & calm' },
  { hex: '#4F46E5', name: 'Indigo Glow',       desc: 'Bold & electric' },
  { hex: '#7C3AED', name: 'Violet Orchid',     desc: 'Creative & unique' },
  { hex: '#DB2777', name: 'Rose Blush',        desc: 'Warm & vibrant' },
  { hex: '#DC2626', name: 'Crimson Red',       desc: 'Striking & urgent' },
  { hex: '#D97706', name: 'Gold Luxury',       desc: 'Premium & warm' },
  { hex: '#EA580C', name: 'Sunset Orange',     desc: 'Energetic & bold' },
  { hex: '#475569', name: 'Slate Charcoal',    desc: 'Sleek & minimal' },
];

export default function StoreSettingsPage() {
  const { tenant } = useAuthStore();
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slugSaving, setSlugSaving] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [activeTab, setActiveTab] = useState<'general' | 'builder' | 'contact'>('general');

  // Storefront CMS Configuration State
  const [config, setConfig] = useState<StorefrontConfig>({
    announcement: { enabled: true, text: '⚡ Welcome to our storefront • Quick Checkout via WhatsApp ⚡' },
    navigation: { logoUrl: '', whatsappEnabled: true, searchEnabled: true },
    hero: { enabled: true, heading: '', subheading: '', ctaText: 'Browse Collection', ctaLink: '#products', bgImageUrl: '', position: 'center' },
    sections: [],
    footer: { newsletterEnabled: true, copyrightText: '' }
  });

  useEffect(() => {
    api.get('/stores/me')
      .then(({ data }) => {
        const fetched = data.data;
        setStore({
          ...fetched,
          theme: fetched.theme || 'CLASSIC',
        });
        setNewSlug(fetched.slug);

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
            // Not JSON configuration, set legacy defaults
            setConfig({
              announcement: { enabled: true, text: '⚡ Welcome to our storefront • Quick Checkout via WhatsApp ⚡' },
              navigation: { logoUrl: fetched.logoUrl || '', whatsappEnabled: true, searchEnabled: true },
              hero: { enabled: true, heading: fetched.headline || '', subheading: fetched.subtitle || '', ctaText: 'Browse Collection', ctaLink: '#products', bgImageUrl: fetched.bannerUrl || '', position: 'center' },
              sections: [
                { id: 'default-products', type: 'products', title: 'Featured Collection', subtitle: 'Products loved by customers', filter: 'latest', limit: 8, enabled: true },
                { id: 'default-about', type: 'promo-banner', title: 'About Our Shop', subtitle: fetched.aboutText || '', imageUrl: fetched.bannerUrl || '', ctaText: 'Chat on WhatsApp', ctaLink: '#', enabled: true }
              ],
              footer: { newsletterEnabled: true, copyrightText: '' }
            });
          }
        } else {
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
        }
      })
      .finally(() => setLoading(false));
  }, []);

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
        aboutText:     serializedConfig, // serialized config saved in aboutText
        address:       store.address,
        contactEmail:  store.contactEmail,
        facebookUrl:   store.facebookUrl,
        instagramUrl:  store.instagramUrl,
      });
      setStore({
        ...data.data,
        theme: data.data.theme || 'CLASSIC',
      });
      toast.success('Store configurations saved successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSlugChange = async () => {
    if (!newSlug || newSlug === store?.slug) return;
    if (!confirm(`Changing your store URL will break any existing links. Continue?`)) return;
    setSlugSaving(true);
    try {
      const { data } = await api.patch('/stores/me/slug', { slug: newSlug });
      setStore((s) => s ? { ...s, slug: data.data.slug } : s);
      toast.success(`Store URL updated to /${data.data.slug}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to update URL');
    } finally {
      slugSaving && setSlugSaving(false);
    }
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
    <div className="max-w-3xl animate-fade-up space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">My Store Settings</h1>
          <a
            href={`/${store.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--brand)] hover:underline flex items-center gap-1 mt-1 font-semibold"
          >
            View Storefront: mywappstore.com/{store.slug}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
          Save Configuration
        </button>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-[var(--border)] gap-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-all duration-150 border-b-2 -mb-[2px] ${
            activeTab === 'general'
              ? 'border-[var(--brand)] text-[var(--brand)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          General Settings
        </button>
        <button
          onClick={() => setActiveTab('builder')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-all duration-150 border-b-2 -mb-[2px] ${
            activeTab === 'builder'
              ? 'border-[var(--brand)] text-[var(--brand)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Storefront Builder
        </button>
        <button
          onClick={() => setActiveTab('contact')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-all duration-150 border-b-2 -mb-[2px] ${
            activeTab === 'contact'
              ? 'border-[var(--brand)] text-[var(--brand)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Contact & Location
        </button>
      </div>

      <div className="space-y-6">
        {activeTab === 'general' && (
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-[var(--text-primary)] text-lg">General Settings</h2>

            <div>
              <label className="label">Store Name</label>
              <input
                className="input"
                value={store.name}
                onChange={(e) => setStore((s) => s ? { ...s, name: e.target.value } : s)}
              />
            </div>

            <div>
              <label className="label" htmlFor="business-type">Business Type</label>
              <select
                id="business-type"
                className="input"
                value={store.businessType ?? 'GENERAL'}
                onChange={(e) => setStore((s) => s ? { ...s, businessType: e.target.value } : s)}
              >
                {BUSINESS_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="store-description">Short Description</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Tell customers what you sell…"
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
                  <span className="text-sm font-medium text-[var(--text-primary)]">Visible in marketplace</span>
                  <p className="text-xs text-[var(--text-muted)]">
                    {store.isPublic ? 'Your store appears in discovery' : 'Only accessible via direct link'}
                  </p>
                </div>
              </label>
            </div>

            <div className="border-t border-[var(--border)] pt-4">
              <label className="label">Brand Accent Color</label>
              <div className="grid grid-cols-5 gap-3 mt-2">
                {BRAND_PALETTE.map(({ hex, name, desc }) => {
                  const isSelected = store.primaryColor?.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      title={`${name} — ${desc}`}
                      onClick={() => setStore((s) => s ? { ...s, primaryColor: hex } : s)}
                      className={`group relative flex flex-col items-center gap-1.5 rounded-xl p-1.5 border-2 transition-all duration-150 ${
                        isSelected
                          ? 'border-[var(--text-primary)] shadow-lg scale-105'
                          : 'border-transparent hover:border-slate-300 hover:scale-105'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg shadow-md flex items-center justify-center" style={{ backgroundColor: hex }}>
                        {isSelected && (
                          <svg className="w-5 h-5 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold text-[var(--text-secondary)] text-center leading-tight">{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-4">
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">Store Domain / URL Slug</h3>
              <div className="flex rounded-lg border border-[var(--border)] focus-within:ring-2 focus-within:ring-[var(--brand)] focus-within:border-transparent">
                <span className="flex items-center px-3 py-2.5 bg-[var(--surface-3)] text-[var(--text-muted)] text-sm border-r border-[var(--border)] shrink-0 whitespace-nowrap">
                  mywappstore.com/
                </span>
                <input
                  className="flex-1 px-3 py-2.5 text-sm bg-white focus:outline-none"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                />
              </div>
              <button onClick={handleSlugChange} className="btn-secondary mt-3">Update Store Slug</button>
            </div>
          </div>
        )}

        {activeTab === 'builder' && (
          <div className="space-y-6">
            {/* Nav & Announcement config */}
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-[var(--text-primary)] text-lg border-b border-[var(--border)] pb-2 flex items-center justify-between">
                <span>Navigation & Announcement</span>
              </h2>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="ann-enabled"
                  checked={config.announcement?.enabled}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    announcement: { ...(prev.announcement || { text: '' }), enabled: e.target.checked }
                  }))}
                />
                <label className="text-sm font-semibold" htmlFor="ann-enabled">Enable Announcement Bar</label>
              </div>

              {config.announcement?.enabled && (
                <>
                  <div>
                    <label className="label">Announcement Text</label>
                    <input
                      className="input"
                      value={config.announcement?.text || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        announcement: { ...(prev.announcement || { enabled: true }), text: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="label">Announcement Link URL (Optional)</label>
                    <input
                      className="input"
                      placeholder="#products"
                      value={config.announcement?.link || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        announcement: { ...(prev.announcement || { enabled: true, text: '' }), link: e.target.value }
                      }))}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="label">Logo Image URL</label>
                <input
                  className="input"
                  placeholder="https://example.com/logo.jpg"
                  value={config.navigation?.logoUrl || ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    navigation: { ...(prev.navigation || { whatsappEnabled: true, searchEnabled: true }), logoUrl: e.target.value }
                  }))}
                />
              </div>

              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="nav-wa"
                    checked={config.navigation?.whatsappEnabled}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      navigation: { ...(prev.navigation || {}), whatsappEnabled: e.target.checked }
                    }))}
                  />
                  <label className="text-sm font-semibold" htmlFor="nav-wa">Show WhatsApp Button</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="nav-search"
                    checked={config.navigation?.searchEnabled}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      navigation: { ...(prev.navigation || {}), searchEnabled: e.target.checked }
                    }))}
                  />
                  <label className="text-sm font-semibold" htmlFor="nav-search">Show Search Bar</label>
                </div>
              </div>
            </div>

            {/* Hero config */}
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-[var(--text-primary)] text-lg border-b border-[var(--border)] pb-2">Hero Section</h2>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="hero-enabled"
                  checked={config.hero?.enabled}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    hero: { ...(prev.hero || { heading: '', subheading: '', ctaText: '', ctaLink: '', bgImageUrl: '', position: 'center' }), enabled: e.target.checked }
                  }))}
                />
                <label className="text-sm font-semibold" htmlFor="hero-enabled">Enable Hero Section</label>
              </div>

              {config.hero?.enabled && (
                <>
                  <div>
                    <label className="label">Heading Title</label>
                    <input
                      className="input"
                      value={config.hero?.heading || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        hero: { ...(prev.hero || { enabled: true, subheading: '', ctaText: '', ctaLink: '', bgImageUrl: '', position: 'center' }), heading: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="label">Subheading Description</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={config.hero?.subheading || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        hero: { ...(prev.hero || { enabled: true, heading: '', ctaText: '', ctaLink: '', bgImageUrl: '', position: 'center' }), subheading: e.target.value }
                      }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Primary Button Text</label>
                      <input
                        className="input"
                        value={config.hero?.ctaText || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          hero: { ...(prev.hero || { enabled: true, heading: '', subheading: '', ctaLink: '', bgImageUrl: '', position: 'center' }), ctaText: e.target.value }
                        }))}
                      />
                    </div>
                    <div>
                      <label className="label">Primary Button URL</label>
                      <input
                        className="input"
                        placeholder="#products"
                        value={config.hero?.ctaLink || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          hero: { ...(prev.hero || { enabled: true, heading: '', subheading: '', ctaText: '', bgImageUrl: '', position: 'center' }), ctaLink: e.target.value }
                        }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Background Image URL (Optional)</label>
                    <input
                      className="input"
                      value={config.hero?.bgImageUrl || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        hero: { ...(prev.hero || { enabled: true, heading: '', subheading: '', ctaText: '', ctaLink: '', position: 'center' }), bgImageUrl: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="label">Content Alignment</label>
                    <select
                      className="input"
                      value={config.hero?.position || 'center'}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        hero: { ...(prev.hero || { enabled: true, heading: '', subheading: '', ctaText: '', ctaLink: '', bgImageUrl: '' }), position: e.target.value as 'left' | 'center' | 'right' }
                      }))}
                    >
                      <option value="left">Align Left</option>
                      <option value="center">Align Center</option>
                      <option value="right">Align Right</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Dynamic sections */}
            <div className="card p-5 space-y-6">
              <h2 className="font-semibold text-[var(--text-primary)] text-lg border-b border-[var(--border)] pb-2 flex items-center justify-between">
                <span>Custom Page Sections</span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => addSection('products')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-1.5 px-3 rounded-lg border flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Product List
                  </button>
                  <button onClick={() => addSection('promo-banner')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-1.5 px-3 rounded-lg border flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Promo Banner
                  </button>
                  <button onClick={() => addSection('testimonials')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-1.5 px-3 rounded-lg border flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Testimonials
                  </button>
                  <button onClick={() => addSection('stats-bar')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-1.5 px-3 rounded-lg border flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Stats Bar
                  </button>
                  <button onClick={() => addSection('feature-grid')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-1.5 px-3 rounded-lg border flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Feature Grid
                  </button>
                  <button onClick={() => addSection('newsletter-cta')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-1.5 px-3 rounded-lg border flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Newsletter CTA
                  </button>
                  <button onClick={() => addSection('about-bento')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-1.5 px-3 rounded-lg border flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> About Bento
                  </button>
                </div>
              </h2>

              {(config.sections || []).length === 0 ? (
                <p className="text-center py-6 text-sm text-[var(--text-muted)] italic">No sections configured. Use the buttons above to build your page!</p>
              ) : (
                <div className="space-y-4">
                  {(config.sections || []).map((sec, index) => (
                    <div key={sec.id} className="border border-[var(--border)] rounded-xl p-4 bg-[var(--surface-2)] space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand)] font-mono">
                          {sec.type} Section
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => moveSection(index, 'up')} className="p-1 rounded bg-white hover:bg-slate-100 border">
                            <ChevronUp className="w-3.5 h-3.5 text-slate-600" />
                          </button>
                          <button onClick={() => moveSection(index, 'down')} className="p-1 rounded bg-white hover:bg-slate-100 border">
                            <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
                          </button>
                          <button onClick={() => removeSection(sec.id)} className="p-1 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label">Section Title</label>
                          <input
                            className="input bg-white"
                            value={sec.title || ''}
                            onChange={(e) => updateSection(sec.id, { title: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label">Section Subtitle / Eyebrow</label>
                          <input
                            className="input bg-white"
                            value={sec.subtitle || ''}
                            onChange={(e) => updateSection(sec.id, { subtitle: e.target.value })}
                          />
                        </div>
                      </div>

                      {sec.type === 'products' && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="label">Catalog Filter Type</label>
                              <select
                                className="input bg-white"
                                value={sec.filter || 'latest'}
                                onChange={(e) => updateSection(sec.id, { filter: e.target.value as any })}
                              >
                                <option value="latest">Latest Arrivals</option>
                                <option value="featured">Featured Items</option>
                                <option value="trending">Trending Favorites</option>
                                <option value="best-sellers">Best Sellers</option>
                              </select>
                            </div>
                            <div>
                              <label className="label">Products Display Limit</label>
                              <input
                                type="number"
                                className="input bg-white"
                                value={sec.limit || 8}
                                onChange={(e) => updateSection(sec.id, { limit: parseInt(e.target.value) || 8 })}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="label">Card Layout Style</label>
                            <select
                              className="input bg-white"
                              value={sec.cardLayout || 'grid'}
                              onChange={(e) => updateSection(sec.id, { cardLayout: e.target.value as any })}
                            >
                              <option value="grid">Standard Grid</option>
                              <option value="carousel">Horizontal Carousel</option>
                              <option value="collage">Masonry Collage</option>
                              <option value="magazine">Magazine Layout</option>
                              <option value="list">Compact List</option>
                              <option value="spotlight">Feature Spotlight</option>
                            </select>
                          </div>
                        </>
                      )}

                      {sec.type === 'promo-banner' && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="label">Banner CTA Button Text</label>
                              <input
                                className="input bg-white"
                                value={sec.ctaText || ''}
                                onChange={(e) => updateSection(sec.id, { ctaText: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="label">Banner CTA URL</label>
                              <input
                                className="input bg-white"
                                placeholder="#products"
                                value={sec.ctaLink || ''}
                                onChange={(e) => updateSection(sec.id, { ctaLink: e.target.value })}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="label">Promotional Image URL</label>
                            <input
                              className="input bg-white"
                              value={sec.imageUrl || ''}
                              onChange={(e) => updateSection(sec.id, { imageUrl: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="label">Countdown End Time</label>
                            <input
                              type="datetime-local"
                              className="input bg-white"
                              value={sec.countdownEndsAt || ''}
                              onChange={(e) => updateSection(sec.id, { countdownEndsAt: e.target.value })}
                            />
                          </div>
                        </>
                      )}

                      {sec.type === 'testimonials' && (
                        <>
                          <div>
                            <label className="label">Display Style</label>
                            <select
                              className="input bg-white"
                              value={sec.testimonialStyle || 'grid'}
                              onChange={(e) => updateSection(sec.id, { testimonialStyle: e.target.value as any })}
                            >
                              <option value="grid">Grid Layout</option>
                              <option value="carousel">Horizontal Carousel</option>
                            </select>
                          </div>
                          <div>
                            <label className="label">Rating Item Count (Dummy Testimonial Setup)</label>
                            <p className="text-xs text-[var(--text-muted)] italic">
                              This showcases verified stars and comments dynamically built inside the storefront layout. Customize details inside settings database properties.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-[var(--text-primary)] text-lg">Location, Contact & Social</h2>

            <div>
              <label className="label">Store Location / Address</label>
              <input
                className="input"
                placeholder="e.g. Plot 12, Cairo Road, Lusaka"
                value={store.address ?? ''}
                onChange={(e) => setStore((s) => s ? { ...s, address: e.target.value } : s)}
              />
            </div>

            <div>
              <label className="label">Customer Contact Email</label>
              <input
                className="input"
                placeholder="hello@mystore.com"
                type="email"
                value={store.contactEmail ?? ''}
                onChange={(e) => setStore((s) => s ? { ...s, contactEmail: e.target.value } : s)}
              />
            </div>

            <div>
              <label className="label">WhatsApp Number</label>
              <input
                className="input"
                placeholder="+260977000001"
                type="tel"
                value={store.phoneWhatsapp ?? ''}
                onChange={(e) => setStore((s) => s ? { ...s, phoneWhatsapp: e.target.value } : s)}
              />
            </div>

            <div>
              <label className="label">Instagram URL</label>
              <input
                className="input"
                placeholder="https://instagram.com/mystore"
                value={store.instagramUrl ?? ''}
                onChange={(e) => setStore((s) => s ? { ...s, instagramUrl: e.target.value } : s)}
              />
            </div>

            <div>
              <label className="label">Facebook URL</label>
              <input
                className="input"
                placeholder="https://facebook.com/mystore"
                value={store.facebookUrl ?? ''}
                onChange={(e) => setStore((s) => s ? { ...s, facebookUrl: e.target.value } : s)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
