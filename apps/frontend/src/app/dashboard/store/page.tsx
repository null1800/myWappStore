'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';

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
}

const BUSINESS_TYPES = [
  { value: 'GENERAL',   label: 'General Store' },
  { value: 'RESTAURANT', label: 'Restaurant / Food' },
  { value: 'RETAIL',    label: 'Retail Shop' },
  { value: 'GROCERY',   label: 'Grocery / Supermarket' },
  { value: 'PHARMACY',  label: 'Pharmacy / Health' },
  { value: 'SERVICE',   label: 'Service Provider' },
];

export default function StoreSettingsPage() {
  const { tenant, setAuth, user } = useAuthStore();
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slugSaving, setSlugSaving] = useState(false);
  const [newSlug, setNewSlug] = useState('');

  useEffect(() => {
    api.get('/stores/me')
      .then(({ data }) => {
        setStore(data.data);
        setNewSlug(data.data.slug);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!store) return;
    setSaving(true);
    try {
      const { data } = await api.patch('/stores/me', {
        name:          store.name,
        description:   store.description,
        phoneWhatsapp: store.phoneWhatsapp,
        primaryColor:  store.primaryColor,
        isPublic:      store.isPublic,
        businessType:  store.businessType,
      });
      setStore(data.data);
      toast.success('Store settings saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to save');
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
      setSlugSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner size="lg" className="text-[var(--brand)]" /></div>;
  if (!store) return null;

  return (
    <div className="max-w-2xl animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">My Store</h1>
        <a
          href={`/${store.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--brand)] hover:underline flex items-center gap-1 mt-1"
        >
          mywappstore.com/{store.slug}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* General settings */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-[var(--text-primary)]">General</h2>

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
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Controls order workflows and storefront labels
          </p>
        </div>

        <div>
          <label className="label" htmlFor="store-description">Description</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Tell customers what you sell…"
            value={store.description ?? ''}
            onChange={(e) => setStore((s) => s ? { ...s, description: e.target.value } : s)}
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
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Customers will send orders to this number
          </p>
        </div>

        <div>
          <label className="label">Brand Colour</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={store.primaryColor}
              onChange={(e) => setStore((s) => s ? { ...s, primaryColor: e.target.value } : s)}
              className="w-10 h-10 rounded-lg border border-[var(--border)] cursor-pointer p-0.5"
            />
            <input
              className="input flex-1"
              value={store.primaryColor}
              onChange={(e) => setStore((s) => s ? { ...s, primaryColor: e.target.value } : s)}
              placeholder="#0F6E56"
            />
          </div>
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

        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <Spinner size="sm" /> : 'Save Settings'}
        </button>
      </div>

      {/* Store URL */}
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-[var(--text-primary)]">Store URL</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Changing this will break existing links to your store.
          </p>
        </div>

        <div>
          <label className="label">Store URL Slug</label>
          <div className="flex rounded-[var(--radius)] border border-[var(--border)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--brand)] focus-within:border-transparent">
            <span className="flex items-center px-3 py-2.5 bg-[var(--surface-3)] text-[var(--text-muted)] text-sm border-r border-[var(--border)] shrink-0 whitespace-nowrap">
              mywappstore.com/
            </span>
            <input
              className="flex-1 px-3 py-2.5 text-sm bg-white focus:outline-none"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            />
          </div>
        </div>

        <button
          onClick={handleSlugChange}
          disabled={slugSaving || newSlug === store.slug}
          className="btn-secondary"
        >
          {slugSaving ? <Spinner size="sm" /> : 'Update URL'}
        </button>
      </div>

      {/* Plan */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[var(--text-primary)]">Plan</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5 capitalize">{store.plan} plan</p>
          </div>
          <span className="badge badge-green capitalize">{store.plan}</span>
        </div>
        <a href="/dashboard/billing" className="mt-3 inline-block text-sm text-[var(--brand)] hover:underline">
          Manage billing →
        </a>
      </div>
    </div>
  );
}
