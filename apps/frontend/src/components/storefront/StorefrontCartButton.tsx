'use client';

import { ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/store/cart.store';
import { useCartDrawerStore } from './CartDrawer';

export function StorefrontCartButton() {
  const openCart = useCartDrawerStore((s) => s.open);
  const count = useCartStore((s) => s.items.reduce((sum, item) => sum + item.quantity, 0));

  return (
    <button
      type="button"
      onClick={openCart}
      className="relative inline-flex items-center justify-center rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-[var(--brand-hover)]"
      aria-label={`Open cart with ${count} items`}
    >
      <ShoppingBag className="h-4 w-4 sm:mr-2" />
      <span className="hidden sm:inline">Cart</span>
      {count > 0 && (
        <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-xs font-black text-white">
          {count}
        </span>
      )}
    </button>
  );
}
