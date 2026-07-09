'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type PageState = 'loading' | 'ready' | 'submitting' | 'done' | 'invalid';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>('loading');
  const [accessToken, setAccessToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Supabase puts the token in the URL hash after its redirect:
  //   /auth/reset-password#access_token=xxx&type=recovery
  // The hash is only readable client-side, so we pull it in a useEffect.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    const type = params.get('type');

    if (!token || type !== 'recovery') {
      setState('invalid');
      return;
    }

    setAccessToken(token);
    setState('ready');

    // Clean the token out of the URL bar so it isn't in browser history
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    setState('submitting');
    try {
      await api.post('/auth/reset-password', { accessToken, newPassword: password });
      setState('done');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Reset failed. The link may have expired — request a new one.');
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
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Set new password</h1>
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
              <p className="font-semibold text-[var(--text-primary)]">Link invalid or expired</p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                This reset link has expired or was already used. Request a new one.
              </p>
            </div>
            <Link href="/forgot-password" className="btn-primary w-full py-3 text-center">
              Request new link
            </Link>
          </div>
        )}

        {state === 'done' && (
          <div className="card p-8 flex flex-col items-center gap-4 text-center">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <div>
              <p className="font-semibold text-[var(--text-primary)]">Password updated</p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                You can now sign in with your new password. All other sessions have been signed out.
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
              <label className="label">New Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
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
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Must contain at least 8 characters, one uppercase, one lowercase, and one number.
            </p>
            <button
              type="submit"
              disabled={state === 'submitting'}
              className="btn-primary w-full py-3"
            >
              {state === 'submitting'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : 'Set new password'
              }
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
