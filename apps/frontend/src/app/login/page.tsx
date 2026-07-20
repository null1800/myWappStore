'use client';



import { useState } from 'react';

import { useRouter } from 'next/navigation';

import Link from 'next/link';

import { Store, Eye, EyeOff, Loader2 } from 'lucide-react';

import { api } from '@/lib/api';

import { useAuthStore } from '@/store/auth.store';

import { toast } from 'sonner';



export default function LoginPage() {

  const router = useRouter();

  const { setAuth } = useAuthStore();

  const [loading, setLoading] = useState(false);

  const [showPw, setShowPw] = useState(false);

  const [form, setForm] = useState({ email: '', password: '' });



  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    setLoading(true);

    try {

      const { data } = await api.post('/auth/login', form);

      const { user, tenant, accessToken } = data.data;

      setAuth(user, tenant, accessToken);

      toast.success(`Welcome back, ${user.fullName ?? user.email}!`);

      router.push('/dashboard');

    } catch (err: any) {

      toast.error(err?.response?.data?.error?.message ?? 'Invalid email or password.');

    } finally {

      setLoading(false);

    }

  };



  return (

    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">

      <div className="w-full max-w-md animate-fade-up">

        {/* Brand */}

        <div className="flex flex-col items-center mb-8">

          <div className="w-14 h-14 rounded-2xl bg-[var(--brand)] flex items-center justify-center shadow-lg mb-4">

            <Store className="w-7 h-7 text-white" />

          </div>

          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Sign in to your store</h1>

          <p className="text-sm text-[var(--text-secondary)] mt-1">

            Don&apos;t have an account?{' '}

            <Link href="/register" className="text-[var(--brand)] hover:underline font-medium">

              Create one free

            </Link>

          </p>

        </div>



        <form onSubmit={handleSubmit} className="card p-6 space-y-4">

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

            <div className="flex items-center justify-between mb-1.5">

              <label className="label" htmlFor="password" style={{ marginBottom: 0 }}>Password</label>

              <Link href="/forgot-password" className="text-xs text-[var(--brand)] hover:underline">

                Forgot password?

              </Link>

            </div>

            <div className="relative">

              <input

                type={showPw ? 'text' : 'password'}

                className="input pr-10"

                placeholder="••••••••"

                required

                value={form.password}

                onChange={(e) => setForm({ ...form, password: e.target.value })}

                autoComplete="current-password"

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



          <button

            type="submit"

            disabled={loading}

            className="btn-primary w-full py-3 mt-2"

          >

            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}

          </button>

        </form>

      </div>

    </div>

  );

}

