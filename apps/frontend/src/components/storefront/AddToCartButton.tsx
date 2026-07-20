'use client';

import { useState } from 'react';
import { ShoppingCart, CheckCircle2, Plus, Minus, Zap, Eye } from 'lucide-react';
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
  const [justAdded, setJustAdded] = useState(false);

  const maxStock = product.maxStock;
  const isLowStock = !product.allowBackorder && maxStock > 0 && maxStock <= 5;

  const handleAdd = () => {
    if (isOutOfStock) return;
    for (let i = 0; i < qty; i++) addItem(product, storeSlug);
    toast.success('Added to cart', { description: `${qty > 1 ? `${qty} × ` : ''}${product.name}` });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
  };

  // ── Out of stock ────────────────────────────────────────────────────────────
  if (isOutOfStock) {
    return (
      <div className="space-y-3">
        <button
          disabled
          className="w-full py-4 rounded-2xl font-bold text-sm bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 flex items-center justify-center gap-2"
          aria-label="Out of stock">
          <ShoppingCart className="w-4 h-4" /> Out of Stock
        </button>
        <p className="text-xs text-center text-slate-400">
          This item is currently unavailable.
        </p>
      </div>
    );
  }

  // ── Already in cart ─────────────────────────────────────────────────────────
  if (inCart) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {/* Qty stepper */}
          <div className="flex items-center gap-1 border border-[var(--border,#e2e8f0)] rounded-2xl p-1">
            <button
              onClick={() => updateQty(product.productId, inCart.quantity - 1)}
              className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-500"
              aria-label="Decrease quantity">
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-black text-lg">{inCart.quantity}</span>
            <button
              onClick={() => updateQty(product.productId, inCart.quantity + 1)}
              disabled={!product.allowBackorder && inCart.quantity >= product.maxStock}
              className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-500 disabled:opacity-30"
              aria-label="Increase quantity">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500">In cart</p>
            <p className="font-black text-base leading-tight">
              {formatCurrency(parseFloat(product.price) * inCart.quantity)}
            </p>
          </div>
        </div>

        <button
          onClick={openCart}
          className="w-full py-4 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #059669 0%, #065f46 100%)',
            boxShadow: '0 8px 24px rgba(5,150,105,0.3)',
          }}>
          <CheckCircle2 className="w-4 h-4" />
          View Cart & Order via WhatsApp
        </button>
      </div>
    );
  }

  // ── Default: add to cart ────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Qty selector row */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold text-slate-500 shrink-0">Qty:</label>
        <div className="flex items-center gap-1 border border-[var(--border,#e2e8f0)] rounded-2xl p-1">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-500"
            aria-label="Decrease quantity">
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-8 text-center font-black text-lg">{qty}</span>
          <button
            onClick={() => setQty((q) => product.allowBackorder ? q + 1 : Math.min(product.maxStock, q + 1))}
            disabled={!product.allowBackorder && qty >= product.maxStock}
            className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-500 disabled:opacity-30"
            aria-label="Increase quantity">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Low stock warning */}
        {isLowStock && (
          <span className="flex items-center gap-1 text-xs font-bold text-amber-600">
            <Zap className="w-3.5 h-3.5" /> {maxStock} left
          </span>
        )}
      </div>

      {/* Add button */}
      <button
        onClick={handleAdd}
        className={`w-full py-4 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 ${
          justAdded ? 'opacity-70 scale-[0.98]' : 'hover:opacity-90'
        }`}
        style={{
          backgroundColor: 'var(--brand)',
          boxShadow: '0 8px 24px color-mix(in srgb, var(--brand) 30%, transparent)',
        }}
        aria-label={`Add ${product.name} to cart`}>
        {justAdded
          ? <><CheckCircle2 className="w-4 h-4" /> Added to cart!</>
          : <><ShoppingCart className="w-4 h-4" /> Add to Cart</>}
      </button>

      {/* Price breakdown hint for qty > 1 */}
      {qty > 1 && (
        <p className="text-xs text-center text-slate-400">
          {qty} × {formatCurrency(product.price)} = <strong className="text-slate-600">{formatCurrency(parseFloat(product.price) * qty)}</strong>
        </p>
      )}
    </div>
  );
}