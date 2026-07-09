'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader2, MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

type PageState = 'syncing' | 'verified' | 'failed' | 'resending' | 'resent';

export default function VerifyEmailPage() {
  const [state, setState] = useState<PageState>('syncing');
  const { user, setAuth, tenant, accessToken } = useAuthStore();

  useEffect(() => {
    const sync = async () => {
      try {
        const { data } = await api.post('/auth/sync-email-verification');
        if (data.data?.emailVerified) {
          // Update in-memory store so dashboard banner disappears immediately
          if (user) {
            setAuth({ ...user, emailVerified: true }, tenant, accessToken);
          }
          setState('verified');
        } else {
          setState('failed');
        }
      } catch {
        setState('failed');
      }
    };
    sync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resend = async () => {
    setState('resending');
    try {
      await api.post('/auth/resend-verification');
      setState('resent');
    } catch {
      setState('failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md animate-fade-up">
        <div className="card p-8 flex flex-col items-center gap-5 text-center">
          {state === 'syncing' && (
            <>
              <Loader2 className="w-10 h-10 animate-spin text-[var(--brand)]" />
              <p className="text-[var(--text-secondary)]">Confirming your email…</p>
            </>
          )}

          {state === 'verified' && (
            <>
              <CheckCircle className="w-12 h-12 text-green-500" />
              <div>
                <p className="text-lg font-semibold text-[var(--text-primary)]">Email verified!</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Your account is fully active. You can now access all features.
                </p>
              </div>
              <Link href="/dashboard" className="btn-primary w-full py-3 text-center">
                Go to dashboard
              </Link>
            </>
          )}

          {(state === 'failed') && (
            <>
              <XCircle className="w-12 h-12 text-red-400" />
              <div>
                <p className="text-lg font-semibold text-[var(--text-primary)]">Verification pending</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  It looks like the link hasn&apos;t been confirmed yet, or it may have expired.
                  Click the link in your email, then come back here — or request a new one.
                </p>
              </div>
              <button onClick={resend} className="btn-primary w-full py-3">
                Resend verification email
              </button>
              <Link href="/dashboard" className="text-sm text-[var(--text-secondary)] hover:underline">
                Back to dashboard
              </Link>
            </>
          )}

          {state === 'resending' && (
            <>
              <Loader2 className="w-10 h-10 animate-spin text-[var(--brand)]" />
              <p className="text-[var(--text-secondary)]">Sending verification email…</p>
            </>
          )}

          {state === 'resent' && (
            <>
              <MailCheck className="w-12 h-12 text-[var(--brand)]" />
              <div>
                <p className="text-lg font-semibold text-[var(--text-primary)]">Email sent!</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Check your inbox for the verification link. Click it, then return here.
                </p>
              </div>
              <Link href="/dashboard" className="text-sm text-[var(--text-secondary)] hover:underline">
                Back to dashboard
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
