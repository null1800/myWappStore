'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { Spinner } from '@/components/ui/Spinner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!accessToken) {
      router.replace('/login');
    }
  }, [accessToken, router]);

  if (!accessToken) {
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
