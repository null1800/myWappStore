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
      className="relative inline-flex items-center justify-center rounded-md border border-lime-300/30 bg-lime-300 px-4 py-2 font-mono text-sm font-black uppercase tracking-wider text-black shadow-lg shadow-lime-950/20 transition hover:bg-lime-200"
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
