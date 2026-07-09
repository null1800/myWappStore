'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Store, Loader2, ArrowLeft, MailCheck } from 'lucide-react';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } catch {
      // Always show success — backend never leaks whether email exists
    } finally {
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md animate-fade-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[var(--brand)] flex items-center justify-center shadow-lg mb-4">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Reset your password</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1 text-center">
            Enter your email and we&apos;ll send a reset link if an account exists.
          </p>
        </div>

        {sent ? (
          <div className="card p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <MailCheck className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-[var(--text-primary)]">Check your inbox</p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                If <span className="font-medium">{email}</span> is registered, you&apos;ll get a reset link shortly. Check spam if you don&apos;t see it.
              </p>
            </div>
            <Link href="/login" className="btn-primary w-full py-3 text-center mt-2">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send reset link'}
            </button>
            <Link
              href="/login"
              className="flex items-center justify-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
