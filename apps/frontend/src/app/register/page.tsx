'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { toast } from 'sonner';

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    businessName: '',
    storeSlug: '',
    phoneWhatsapp: '',
  });

  // Auto-generate slug from business name
  const handleBusinessNameChange = (value: string) => {
    const slug = value.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
    setForm((f) => ({ ...f, businessName: value, storeSlug: slug }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        businessName: form.businessName,
        storeSlug: form.storeSlug,
        phoneWhatsapp: form.phoneWhatsapp || undefined,
      });
      toast.success('Account created! Please sign in.');
      router.push('/login');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="w-full max-w-md animate-fade-up">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[var(--brand)] flex items-center justify-center shadow-lg mb-4">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Create your store</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Already have an account?{' '}
            <Link href="/login" className="text-[var(--brand)] hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="label">Your Full Name</label>
            <input
              type="text"
              className="input"
              placeholder="John Banda"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Business / Store Name</label>
            <input
              type="text"
              className="input"
              placeholder="Banda Electronics"
              required
              value={form.businessName}
              onChange={(e) => handleBusinessNameChange(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Store URL</label>
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--brand)] focus-within:border-transparent">
              <span className="flex items-center px-3 py-2.5 bg-[var(--surface-2)] text-[var(--text-muted)] text-sm border-r border-[var(--border)] shrink-0 whitespace-nowrap">
                mywappstore.com/
              </span>
              <input
                type="text"
                className="flex-1 px-3 py-2.5 text-sm bg-[var(--surface-1)] text-[var(--text-primary)] focus:outline-none"
                placeholder="banda-electronics"
                required
                value={form.storeSlug}
                onChange={(e) =>
                  setForm({ ...form, storeSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
                }
              />
            </div>
          </div>

          <div>
            <label className="label">WhatsApp Number</label>
            <input
              type="tel"
              className="input"
              placeholder="+260977000001"
              value={form.phoneWhatsapp}
              onChange={(e) => setForm({ ...form, phoneWhatsapp: e.target.value })}
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Customers will send orders to this number
            </p>
          </div>

          <div>
            <label className="label">Email Address</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className="input pr-10"
                placeholder="Min. 8 characters"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Store & Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
