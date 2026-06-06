import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
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
  setAuth: (user: User | null, tenant: Tenant | null, accessToken: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      accessToken: null,
      setAuth: (user, tenant, accessToken) => set({ user, tenant, accessToken }),
      logout: () => set({ user: null, tenant: null, accessToken: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
