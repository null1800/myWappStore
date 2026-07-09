'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { silentRefresh } from '@/lib/api';

// The access token lives in memory only (never persisted to localStorage —
// see auth.store.ts), so every full page load starts with accessToken: null
// even for an already-logged-in user. This runs once at the app root and
// quietly tries to reclaim a session from the HttpOnly refresh cookie
// before any page has a chance to redirect to /login.
export function AuthBootstrap() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    // Wait for zustand's persist middleware to finish reading localStorage
    // (gives us `user`/`tenant`) before deciding whether there's a session
    // worth trying to restore.
    if (!hasHydrated) return;

    // Only known-logged-in users (we persisted user/tenant before) are
    // worth attempting a refresh for — avoids a pointless network call on
    // every visit to a public storefront page.
    if (user && !accessToken) {
      silentRefresh();
    }
  }, [hasHydrated, user, accessToken]);

  return null;
}
