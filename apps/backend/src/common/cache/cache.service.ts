// Lightweight in-process TTL cache for public storefront API responses.
//
// Design intent:
// - The public storefront endpoints (store info, product listings) are read-only
//   and change infrequently (product added/updated → cache invalidated instantly
//   by calling invalidate()). They're also the highest-traffic endpoints.
// - A simple Map-based TTL cache handles this at MVP scale without requiring
//   a Redis instance. The cache lives in the NestJS process memory.
// - Limitation: cache is per-process. In a multi-instance deployment each
//   instance has its own cache — acceptable, since misses just hit Postgres.
//   When you need a shared cache (Redis), swap this service out; callers don't
//   change (they use the same get/set/invalidate interface).
//
// Usage (inject into StoresService):
//   const key = `store:${slug}`;
//   const hit = this.cache.get<StoreData>(key);
//   if (hit) return hit;
//   const data = await this.prisma...;
//   this.cache.set(key, data);
//   return data;

import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60_000; // 60 seconds
const MAX_ENTRIES = 500;       // keep memory bounded

@Injectable()
export class InProcessCacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
    // Evict oldest entries if at capacity (simple LRU approximation)
    if (this.store.size >= MAX_ENTRIES) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  // Invalidate a specific key or all keys matching a prefix
  invalidate(keyOrPrefix: string): void {
    for (const key of this.store.keys()) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        this.store.delete(key);
      }
    }
  }

  get size(): number {
    return this.store.size;
  }
}
