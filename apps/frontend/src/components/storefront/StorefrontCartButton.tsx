'use client';

import { useEffect, useRef, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/store/cart.store';
import { useCartDrawerStore } from './CartDrawer';

export function StorefrontCartButton() {
  const openCart = useCartDrawerStore((s) => s.open);
  const count = useCartStore((s) => s.items.reduce((sum, item) => sum + item.quantity, 0));
  const [animating, setAnimating] = useState(false);
  const prevCount = useRef(count);

  // Trigger bounce animation whenever count increases
  useEffect(() => {
    if (count > prevCount.current) {
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 600);
      return () => clearTimeout(t);
    }
    prevCount.current = count;
  }, [count]);

  return (
    <button
      type="button"
      onClick={openCart}
      className="relative inline-flex items-center justify-center rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-[var(--brand-hover)] active:scale-95"
      aria-label={`Open cart with ${count} items`}
    >
      <ShoppingBag className={`h-4 w-4 sm:mr-2 transition-transform duration-300 ${animating ? 'scale-125' : 'scale-100'}`} />
      <span className="hidden sm:inline">Cart</span>
      {count > 0 && (
        <span
          className={`absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-xs font-black text-white transition-transform ${
            animating ? 'scale-125' : 'scale-100'
          }`}
          style={{ transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}