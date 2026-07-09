'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type PageState = 'loading' | 'ready' | 'submitting' | 'done' | 'invalid';

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<PageState>('loading');
  const [token, setToken] = useState('');
  const [form, setForm] = useState({ fullName: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    const t = searchParams.get('token');
    if (!t) { setState('invalid'); return; }
    setToken(t);
    setState('ready');
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    setState('submitting');
    try {
      await api.post('/staff/accept-invite', {
        token,
        fullName: form.fullName,
        password: form.password,
      });
      setState('done');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to accept invite. The link may have expired.');
      setState('ready');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md animate-fade-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[var(--brand)] flex items-center justify-center shadow-lg mb-4">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Join your team</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1 text-center">
            Set up your account to accept the invitation.
          </p>
        </div>

        {state === 'loading' && (
          <div className="card p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
          </div>
        )}

        {state === 'invalid' && (
          <div className="card p-8 flex flex-col items-center gap-4 text-center">
            <XCircle className="w-12 h-12 text-red-500" />
            <div>
              <p className="font-semibold text-[var(--text-primary)]">Invalid invitation link</p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                This link is missing a token. Ask the store owner to send a new invitation.
              </p>
            </div>
          </div>
        )}

        {state === 'done' && (
          <div className="card p-8 flex flex-col items-center gap-4 text-center">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <div>
              <p className="font-semibold text-[var(--text-primary)]">Account created!</p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Your account is ready. Sign in to access the store dashboard.
              </p>
            </div>
            <Link href="/login" className="btn-primary w-full py-3 text-center">
              Sign in
            </Link>
          </div>
        )}

        {(state === 'ready' || state === 'submitting') && (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            <div>
              <label className="label">Your Name</label>
              <input
                type="text"
                className="input"
                placeholder="Jane Banda"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                autoComplete="name"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                className="input"
                placeholder="Repeat password"
                required
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={state === 'submitting'}
              className="btn-primary w-full py-3"
            >
              {state === 'submitting'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : 'Create account & join'
              }
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
