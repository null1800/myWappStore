'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function BillingVerifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [plan, setPlan] = useState('');

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (!ref) { setState('failed'); return; }

    api.get(`/billing/verify?ref=${ref}`)
      .then(({ data }) => {
        setPlan(data.data?.plan ?? '');
        setState('success');
        // Redirect to billing page after 3s
        setTimeout(() => router.push('/dashboard/billing'), 3000);
      })
      .catch(() => setState('failed'));
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md animate-fade-up">
        <div className="card p-10 flex flex-col items-center gap-5 text-center">
          {state === 'verifying' && (
            <>
              <Loader2 className="w-10 h-10 animate-spin text-[var(--brand)]" />
              <p className="text-[var(--text-secondary)]">Verifying your payment…</p>
            </>
          )}
          {state === 'success' && (
            <>
              <CheckCircle className="w-14 h-14 text-green-500" />
              <div>
                <p className="text-xl font-bold text-[var(--text-primary)]">Payment confirmed!</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Your plan has been upgraded to <strong className="capitalize">{plan}</strong>.
                  Redirecting to your dashboard…
                </p>
              </div>
            </>
          )}
          {state === 'failed' && (
            <>
              <XCircle className="w-14 h-14 text-red-500" />
              <div>
                <p className="text-xl font-bold text-[var(--text-primary)]">Verification failed</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  The payment could not be confirmed. If you were charged, please contact support.
                </p>
              </div>
              <Link href="/dashboard/billing" className="btn-primary w-full py-3 text-center">
                Back to billing
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
