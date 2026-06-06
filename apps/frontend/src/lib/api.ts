import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// Authenticated api instance
export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
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

// Response interceptor to handle token expiration / auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Clear auth store if unauthorized (e.g. token expired and refresh failed)
      useAuthStore.getState().logout();
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
