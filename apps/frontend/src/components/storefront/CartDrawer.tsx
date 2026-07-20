'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { create } from 'zustand';
import {
  X, ShoppingBag, ArrowRight, MessageSquare, MapPin, User, Phone, Mail,
  CreditCard, ShieldCheck, Truck, Zap, Trash2, Package, CheckCircle2,
  Clock, ChevronLeft, RotateCcw, BadgeCheck, MessageCircle, Minus, Plus,
} from 'lucide-react';
import { useCartStore } from '@/store/cart.store';
import { publicApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const r = (error as { response?: { data?: { error?: { message?: unknown } } } }).response;
    if (typeof r?.data?.error?.message === 'string') return r.data.error.message;
  }
  return fallback;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface CartDrawerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useCartDrawerStore = create<CartDrawerState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

// ─── Step Indicator ───────────────────────────────────────────────────────────

type Step = 'cart' | 'checkout' | 'success';

function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'cart', label: 'Cart' },
    { id: 'checkout', label: 'Details' },
    { id: 'success', label: 'Done' },
  ];
  const currentIdx = steps.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center" aria-label="Checkout progress" role="navigation">
      {steps.map((step, i) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
              i < currentIdx
                ? 'bg-emerald-500 text-white'
                : i === currentIdx
                ? 'bg-[var(--brand)] text-white ring-4 ring-[var(--brand)]/20'
                : 'bg-[var(--surface-3,#f1f5f9)] text-slate-400'
            }`}
              aria-current={i === currentIdx ? 'step' : undefined}>
              {i < currentIdx ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-wider leading-none ${
              i === currentIdx ? 'text-[var(--brand)]' : 'text-slate-400'
            }`}>{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-all duration-500 ${
              i < currentIdx ? 'bg-emerald-500' : 'bg-slate-200'
            }`} aria-hidden="true" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
          <ShoppingBag className="w-10 h-10 text-slate-300" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-[var(--brand)] flex items-center justify-center text-white text-sm font-black">
          0
        </div>
      </div>
      <h3 className="font-black text-xl text-[var(--text-primary)]">Your cart is empty</h3>
      <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-xs leading-relaxed">
        Browse the store and add items to get started. Quick checkout via WhatsApp!
      </p>
      <button
        onClick={onClose}
        className="mt-6 px-6 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
        style={{ backgroundColor: 'var(--brand)' }}>
        Continue shopping
      </button>
    </div>
  );
}

// ─── Success State ────────────────────────────────────────────────────────────

function OrderSuccess({ orderRef }: { orderRef: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-16 px-6 gap-5">
      {/* Animated checkmark ring */}
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </div>
        <div className="absolute inset-0 rounded-full border-4 border-emerald-200 animate-ping opacity-30" aria-hidden="true" />
      </div>

      <div>
        <h3 className="font-black text-2xl text-[var(--text-primary)]">Order placed!</h3>
        {orderRef && (
          <p className="mt-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-600 font-semibold inline-block">
            Ref: #{orderRef}
          </p>
        )}
      </div>

      <p className="text-sm text-[var(--text-secondary)] max-w-xs leading-relaxed">
        Redirecting you to WhatsApp to confirm with the seller and arrange delivery.
      </p>

      <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-4 py-2.5 rounded-xl">
        <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '2s' }} />
        <span>Opening WhatsApp...</span>
      </div>
    </div>
  );
}

// ─── Cart Item Row ────────────────────────────────────────────────────────────

function CartItemRow({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  item: { productId: string; name: string; price: string; image: string | null; quantity: number; maxStock: number; allowBackorder: boolean };
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}) {
  const lineTotal = parseFloat(item.price) * item.quantity;

  return (
    <div className="group flex gap-3.5 p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--brand)]/30 transition-all duration-200">
      {/* Thumbnail */}
      <div className="relative w-[68px] h-[68px] rounded-xl overflow-hidden bg-slate-100 shrink-0">
        {item.image
          ? <Image src={item.image} alt={item.name} fill className="object-cover" sizes="68px" />
          : <div className="absolute inset-0 flex items-center justify-center text-2xl">📦</div>}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm text-[var(--text-primary)] line-clamp-2 leading-snug flex-1">{item.name}</h4>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 shrink-0"
            aria-label={`Remove ${item.name}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--brand)' }}>
          {formatCurrency(item.price)} each
        </p>

        <div className="flex items-center justify-between mt-2.5">
          {/* Qty controls */}
          <div className="flex items-center gap-1 bg-[var(--surface-3,#f8fafc)] border border-[var(--border)] rounded-xl px-1 py-0.5">
            <button
              onClick={onDecrease}
              className="w-7 h-7 rounded-lg hover:bg-white flex items-center justify-center transition-colors text-slate-500 hover:text-slate-700"
              aria-label="Decrease quantity">
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-xs font-black w-5 text-center text-[var(--text-primary)]">{item.quantity}</span>
            <button
              onClick={onIncrease}
              disabled={!item.allowBackorder && item.quantity >= item.maxStock}
              className="w-7 h-7 rounded-lg hover:bg-white flex items-center justify-center transition-colors text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Increase quantity">
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Line total */}
          <p className="text-sm font-black text-[var(--text-primary)]">{formatCurrency(lineTotal)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Payment Option ───────────────────────────────────────────────────────────

function PaymentOption({
  value, selected, icon, label, description, onChange,
}: {
  value: string; selected: boolean; icon: string; label: string; description: string;
  onChange: (v: string) => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 ${
        selected
          ? 'border-[var(--brand)] bg-[var(--brand-light,rgba(16,185,129,0.06))] shadow-sm'
          : 'border-[var(--border)] hover:border-[var(--brand)]/40'
      }`}>
      <input type="radio" name="paymentMethod" value={value} checked={selected} onChange={(e) => onChange(e.target.value)} className="mt-0.5 accent-[var(--brand)] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
          <span>{icon}</span> {label}
        </p>
        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">{description}</p>
      </div>
    </label>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────

function Field({
  label, required, hint, children,
}: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)]">
        {label}
        {required && <span className="text-red-500 text-sm leading-none">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

// ─── Main CartDrawer ───────────────────────────────────────────────────────────

interface CartDrawerProps {
  storeSlug: string;
}

const PAYMENT_OPTIONS = [
  { value: 'whatsapp',      icon: '💬', label: 'WhatsApp Checkout',    description: 'Confirm and pay (Cash or MoMo) via WhatsApp chat' },
  { value: 'mobile_money',  icon: '📱', label: 'Mobile Money',         description: 'MTN / Airtel — payment details sent via WhatsApp' },
  { value: 'cash',          icon: '💵', label: 'Cash on Delivery',     description: 'Pay when your order arrives at your door' },
];

export function CartDrawer({ storeSlug }: CartDrawerProps) {
  const { isOpen, close } = useCartDrawerStore();
  const { items, updateQty, removeItem, clearCart } = useCartStore();

  const [step, setStep] = useState<Step>('cart');
  const [loading, setLoading] = useState(false);
  const [orderRef, setOrderRef] = useState('');

  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerWhatsapp: '',
    customerEmail: '',
    deliveryAddress: '',
    notes: '',
    paymentMethod: 'whatsapp',
  });

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Keyboard close
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [isOpen]);

  if (!isOpen) return null;

  const subtotal = items.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const currency = 'ZMW';

  const pf = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleClose = () => {
    close();
    setTimeout(() => {
      if (step === 'success') {
        setStep('cart');
        setOrderRef('');
        setForm({ customerName: '', customerPhone: '', customerWhatsapp: '', customerEmail: '', deliveryAddress: '', notes: '', paymentMethod: 'whatsapp' });
      }
    }, 350);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    if (!form.customerName.trim() || !form.customerWhatsapp.trim() || !form.deliveryAddress.trim()) {
      toast.error('Please fill in all required fields', { description: 'Name, WhatsApp number, and delivery address are needed.' });
      return;
    }

    setLoading(true);
    try {
      const { data } = await publicApi.post('/orders', {
        storeSlug,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        customerName: form.customerName,
        customerPhone: form.customerPhone || undefined,
        customerWhatsapp: form.customerWhatsapp,
        customerEmail: form.customerEmail || undefined,
        deliveryAddress: form.deliveryAddress,
        notes: form.notes || undefined,
        paymentMethod: form.paymentMethod,
      });

      const ref = data.data?.orderNumber || data.data?.id?.slice(0, 8)?.toUpperCase() || 'NEW';
      setOrderRef(ref);
      setStep('success');
      clearCart();

      // Redirect after brief success screen
      setTimeout(() => {
        if (data.data?.whatsappUrl) window.location.href = data.data.whatsappUrl;
      }, 2200);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to place order. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Shopping cart">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="absolute inset-y-0 right-0 flex max-w-full">
        <div className="relative w-screen max-w-md flex flex-col h-full bg-[var(--background,#ffffff)] border-l border-[var(--border,#e2e8f0)] shadow-2xl">

          {/* ── Header ── */}
          <div className="shrink-0 px-6 py-5 border-b border-[var(--border)]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-[var(--text-primary)] flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" style={{ color: 'var(--brand)' }} />
                {step === 'cart' ? 'Cart' : step === 'checkout' ? 'Checkout' : 'Order Confirmed'}
              </h2>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-100 transition-all"
                aria-label="Close cart">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step indicator — only when cart has items and not success */}
            {items.length > 0 && step !== 'success' && <StepIndicator current={step} />}
            {step === 'cart' && items.length > 0 && (
              <p className="text-xs text-[var(--text-secondary)] mt-3">
                {itemCount} item{itemCount !== 1 ? 's' : ''} · {formatCurrency(subtotal, currency)} total
              </p>
            )}
          </div>

          {/* ── Scrollable Body ── */}
          <div className="flex-1 overflow-y-auto">
            {/* Empty state */}
            {items.length === 0 && step !== 'success'
              ? <EmptyCart onClose={handleClose} />
              : step === 'success'
              ? <OrderSuccess orderRef={orderRef} />
              : step === 'cart'
              ? (
                /* ── Cart Step ── */
                <div className="px-6 py-5 space-y-3">
                  {items.map((item) => (
                    <CartItemRow
                      key={item.productId}
                      item={item}
                      onDecrease={() => updateQty(item.productId, item.quantity - 1)}
                      onIncrease={() => updateQty(item.productId, item.quantity + 1)}
                      onRemove={() => removeItem(item.productId)}
                    />
                  ))}

                  {/* Order summary */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-3 mt-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Order summary</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
                        <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(subtotal, currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Delivery fee</span>
                        <span className="font-semibold text-emerald-600 text-xs">Arranged via WhatsApp</span>
                      </div>
                      <div className="border-t border-[var(--border)] pt-2 flex justify-between">
                        <span className="font-bold text-[var(--text-primary)]">Estimated total</span>
                        <span className="font-black text-lg text-[var(--text-primary)]">{formatCurrency(subtotal, currency)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Trust badges */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      [ShieldCheck, 'Secure'],
                      [Truck, 'Fast ship'],
                      [RotateCcw, 'Easy return'],
                    ].map(([Icon, label]: any) => (
                      <div key={label} className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] text-center">
                        <Icon className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* WhatsApp note */}
                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      <strong>WhatsApp checkout:</strong> After confirming your order, you'll be connected directly with the seller on WhatsApp.
                    </p>
                  </div>
                </div>
              ) : (
                /* ── Checkout Step ── */
                <form onSubmit={handleSubmit} id="checkout-form" className="px-6 py-5 space-y-5">

                  {/* Contact section */}
                  <div className="space-y-4">
                    <p className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Contact information
                    </p>

                    <Field label="Full name" required>
                      <input type="text" required className="input" placeholder="Your full name"
                        value={form.customerName} onChange={pf('customerName')} />
                    </Field>

                    <Field label="WhatsApp number" required hint="Include country code — e.g. +260977123456">
                      <input type="tel" required className="input" placeholder="+260 977 123 456"
                        value={form.customerWhatsapp} onChange={pf('customerWhatsapp')} />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Phone (optional)">
                        <input type="tel" className="input" placeholder="0977 123 456"
                          value={form.customerPhone} onChange={pf('customerPhone')} />
                      </Field>
                      <Field label="Email (optional)">
                        <input type="email" className="input" placeholder="you@email.com"
                          value={form.customerEmail} onChange={pf('customerEmail')} />
                      </Field>
                    </div>
                  </div>

                  {/* Delivery section */}
                  <div className="space-y-4">
                    <p className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Delivery details
                    </p>

                    <Field label="Delivery address" required>
                      <textarea required rows={3} className="input resize-none"
                        placeholder="House 12, President Avenue, Lusaka, Zambia"
                        value={form.deliveryAddress} onChange={pf('deliveryAddress')} />
                    </Field>

                    <Field label="Order notes (optional)">
                      <textarea rows={2} className="input resize-none"
                        placeholder="e.g. Call before delivery · Preferred colour · Gate code..."
                        value={form.notes} onChange={pf('notes')} />
                    </Field>
                  </div>

                  {/* Payment section */}
                  <div className="space-y-3">
                    <p className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Payment method
                    </p>
                    {PAYMENT_OPTIONS.map((opt) => (
                      <PaymentOption key={opt.value} {...opt}
                        selected={form.paymentMethod === opt.value}
                        onChange={(v) => setForm((f) => ({ ...f, paymentMethod: v }))} />
                    ))}
                  </div>

                  {/* Order recap */}
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]">
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <Package className="w-4 h-4" />
                      <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="font-black text-[var(--text-primary)] text-lg">{formatCurrency(subtotal, currency)}</span>
                  </div>
                </form>
              )}
          </div>

          {/* ── Footer Actions ── */}
          {items.length > 0 && step !== 'success' && (
            <div className="shrink-0 px-6 py-5 border-t border-[var(--border)] bg-[var(--surface-2,#f8fafc)] space-y-3">

              {/* Subtotal row */}
              {step === 'checkout' && (
                <div className="flex items-center justify-between pb-1">
                  <span className="text-sm text-[var(--text-secondary)]">Order total</span>
                  <span className="text-2xl font-black text-[var(--text-primary)]">{formatCurrency(subtotal, currency)}</span>
                </div>
              )}

              {step === 'cart' ? (
                <button
                  onClick={() => setStep('checkout')}
                  className="w-full py-4 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] shadow-lg"
                  style={{ backgroundColor: 'var(--brand)', boxShadow: '0 8px 24px color-mix(in srgb, var(--brand) 30%, transparent)' }}>
                  Proceed to checkout
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setStep('cart')}
                    disabled={loading}
                    className="flex items-center justify-center gap-1.5 px-4 py-4 rounded-2xl text-sm font-bold border border-[var(--border)] text-[var(--text-primary)] hover:bg-slate-50 transition-all disabled:opacity-40">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={loading}
                    className="flex-1 py-4 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] shadow-lg disabled:opacity-60"
                    style={{ backgroundColor: 'var(--brand)', boxShadow: '0 8px 24px color-mix(in srgb, var(--brand) 30%, transparent)' }}>
                    {loading
                      ? <><Spinner size="sm" /><span>Placing order…</span></>
                      : <><MessageCircle className="w-4 h-4" /> Place order via WhatsApp</>}
                  </button>
                </div>
              )}

              {/* Security note */}
              <div className="flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <p className="text-[10px] text-[var(--text-muted)] text-center">
                  Your info is shared only with the seller to fulfil your order
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}