'use client';

import Link from 'next/link';
import { MailWarning, X } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';

export function EmailVerificationBanner() {
  const user = useAuthStore((s) => s.user);
  const [dismissed, setDismissed] = useState(false);

  // Only show when we know the user is unverified
  if (!user || user.emailVerified || dismissed) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl mb-6 text-sm">
      <MailWarning className="w-4 h-4 text-amber-600 shrink-0" />
      <p className="flex-1 text-amber-800">
        Please verify your email address to unlock all features.{' '}
        <Link
          href="/auth/verify-email"
          className="font-medium underline underline-offset-2 hover:text-amber-900"
        >
          Verify now
        </Link>
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-500 hover:text-amber-700 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
