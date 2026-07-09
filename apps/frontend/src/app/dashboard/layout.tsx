'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { Spinner } from '@/components/ui/Spinner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, accessToken, hasHydrated } = useAuthStore();
  const router = useRouter();

  // accessToken lives in memory only and is empty on every fresh page load —
  // AuthBootstrap (mounted at the app root) attempts a silent refresh using
  // the HttpOnly cookie. We wait for that to resolve one way or the other
  // instead of redirecting the instant accessToken is null, which would
  // bounce an already-logged-in user back to /login on every reload.
  const stillResolvingSession = hasHydrated && !!user && !accessToken;

  useEffect(() => {
    if (hasHydrated && !user) {
      router.replace('/login');
    }
  }, [hasHydrated, user, router]);

  if (!hasHydrated || stillResolvingSession || !accessToken) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" className="text-[var(--brand)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <DashboardSidebar />
      <main className="flex-1 min-w-0 lg:overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
