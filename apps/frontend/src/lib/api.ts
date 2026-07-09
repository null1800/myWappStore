import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// Authenticated api instance
export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Required so the HttpOnly refresh_token cookie (set by the backend on
  // login) is actually sent on requests and accepted on responses — without
  // this, cross-origin cookies are dropped by the browser and refresh/logout
  // silently no-op.
  withCredentials: true,
});

// Attach Authorization token interceptor
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Calls /auth/refresh using the HttpOnly refresh cookie to obtain a fresh
// access token. Used both on app load (the access token lives in memory
// only, so a page reload starts with none) and as a 401 retry below.
// Multiple callers in-flight share one request instead of firing N refreshes.
let refreshInFlight: Promise<string | null> | null = null;

export function silentRefresh(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        const accessToken = res.data?.data?.accessToken ?? null;
        useAuthStore.getState().setAccessToken(accessToken);
        return accessToken;
      })
      .catch(() => {
        useAuthStore.getState().logout();
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// Response interceptor to handle token expiration / auth errors.
// On a 401, try one silent refresh + retry before giving up — the access
// token is short-lived and no longer persisted, so this is the normal path
// for "token expired mid-session", not just an edge case.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      const newToken = await silentRefresh();

      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }

      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Public API instance for storefront pages (no token needed)
export const publicApi = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});
