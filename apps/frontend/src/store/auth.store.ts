import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  emailVerified: boolean;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
}

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  accessToken: string | null;
  hasHydrated: boolean;
  setAuth: (user: User | null, tenant: Tenant | null, accessToken: string | null) => void;
  setAccessToken: (accessToken: string | null) => void;
  setHasHydrated: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      accessToken: null,
      hasHydrated: false,
      setAuth: (user, tenant, accessToken) => set({ user, tenant, accessToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      logout: () => set({ user: null, tenant: null, accessToken: null }),
    }),
    {
      name: 'auth-storage',
      // SECURITY: never persist the access token to localStorage — it's a
      // bearer JWT, so anything that can run JS on the page (XSS) could
      // read it straight out of storage. user/tenant are just display data,
      // safe to keep around so the UI doesn't flash empty on reload.
      // The access token itself stays in memory only and is re-obtained via
      // a silent /auth/refresh call (using the HttpOnly refresh cookie) on
      // app load — see AuthBootstrap.
      partialize: (state) => ({ user: state.user, tenant: state.tenant }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
