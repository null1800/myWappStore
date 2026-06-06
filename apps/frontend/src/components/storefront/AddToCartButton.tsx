'use client';

import { useState } from 'react';
import { ShoppingCart, Check, Plus, Minus } from 'lucide-react';
import { useCartStore, CartItem } from '@/store/cart.store';
import { useCartDrawerStore } from './CartDrawer';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface AddToCartButtonProps {
  product: Omit<CartItem, 'quantity' | 'storeSlug'>;
  storeSlug: string;
  isOutOfStock: boolean;
}

export function AddToCartButton({ product, storeSlug, isOutOfStock }: AddToCartButtonProps) {
  const { addItem, getItem, updateQty } = useCartStore();
  const openCart = useCartDrawerStore((s) => s.open);
  const inCart = getItem(product.productId);
  const [qty, setQty] = useState(1);

  const handleAdd = () => {
    if (isOutOfStock) return;

    // Add qty times (by calling addItem which increments by 1 each time)
    for (let i = 0; i < qty; i++) {
      addItem(product, storeSlug);
    }
    toast.success(`Added to cart`, { description: `${qty} × ${product.name}` });
    openCart();
  };

  if (isOutOfStock) {
    return (
      <button disabled className="btn-primary w-full py-4 text-base opacity-50 cursor-not-allowed">
        Out of Stock
      </button>
    );
  }

  if (inCart) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 card p-1">
            <button
              onClick={() => updateQty(product.productId, inCart.quantity - 1)}
              className="w-9 h-9 rounded-lg hover:bg-[var(--surface-2)] flex items-center justify-center transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-semibold text-lg">{inCart.quantity}</span>
            <button
              onClick={() => updateQty(product.productId, inCart.quantity + 1)}
              disabled={!product.allowBackorder && inCart.quantity >= product.maxStock}
              className="w-9 h-9 rounded-lg hover:bg-[var(--surface-2)] flex items-center justify-center transition-colors disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <span className="text-sm text-[var(--text-secondary)]">
            {formatCurrency(parseFloat(product.price) * inCart.quantity)} total
          </span>
        </div>
        <button
          onClick={openCart}
          className="btn-whatsapp w-full py-4 text-base"
        >
          <Check className="w-5 h-5" />
          View Cart & Order via WhatsApp
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Quantity selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-[var(--text-secondary)]">Qty:</label>
        <div className="flex items-center gap-2 card p-1">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="w-9 h-9 rounded-lg hover:bg-[var(--surface-2)] flex items-center justify-center transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-8 text-center font-semibold text-lg">{qty}</span>
          <button
            onClick={() => setQty((q) => product.allowBackorder ? q + 1 : Math.min(product.maxStock, q + 1))}
            disabled={!product.allowBackorder && qty >= product.maxStock}
            className="w-9 h-9 rounded-lg hover:bg-[var(--surface-2)] flex items-center justify-center transition-colors disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <button onClick={handleAdd} className="btn-whatsapp w-full py-4 text-base">
        <ShoppingCart className="w-5 h-5" />
        Add to Cart
      </button>
    </div>
  );
}
