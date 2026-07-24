'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MessageCircle, ChevronRight,
  User, MapPin, FileText,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  formatCurrency, formatDateTime,
  ORDER_STATUS_BADGE, ORDER_STATUS_LABELS,
  PAYMENT_STATUS_BADGE,
} from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';

const NEXT_STATUS: Record<string, string | null> = {
  PENDING:    'CONFIRMED',
  CONFIRMED:  'PACKED',
  PACKED:     'READY',      // restaurant/pickup path
  READY:      'DELIVERED',
  DISPATCHED: 'DELIVERED',  // delivery path (PACKED → DISPATCHED)
  DELIVERED:  null,
  QUOTE_SENT: 'CONFIRMED',
  BOOKED:     'DELIVERED',
  CANCELLED:  null,
  REFUNDED:   null,
};

// Secondary action — PACKED can go to DISPATCHED (delivery) instead of READY
const ALT_NEXT_STATUS: Record<string, { status: string; label: string } | undefined> = {
  PACKED: { status: 'DISPATCHED', label: 'Mark as Dispatched' },
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  CONFIRMED:  'Accept & Confirm Order',
  PACKED:     'Mark as Packed & Ready',
  READY:      'Ready for Customer Pickup',
  DISPATCHED: 'Mark as Out for Delivery',
  DELIVERED:  'Mark Order as Delivered',
  BOOKED:     'Confirm Booking',
};

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  fulfillmentType: string | null;
  deliveryAddress: string | null;
  scheduledFor: string | null;
  estimatedReadyAt: string | null;
  tableNumber: string | null;
  subtotal: string;
  discountAmount: string;
  total: string;
  currency: string;
  notes: string | null;
  merchantNotes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    fullName: string | null;
    phone: string | null;
    whatsappNumber: string | null;
    email: string | null;
  } | null;
  items: Array<{
    id: string;
    productName: string;
    productSku: string | null;
    unitPrice: string;
    quantity: number;
    lineTotal: string;
  }>;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [merchantNotes, setMerchantNotes] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/orders/${id}`)
      .then(({ data }) => {
        setOrder(data.data);
        setMerchantNotes(data.data.merchantNotes ?? '');
      })
      .catch(() => router.push('/dashboard/orders'))
      .finally(() => setLoading(false));

    // Load WhatsApp link
    api.get(`/orders/${id}/whatsapp`)
      .then(({ data }) => setWhatsappUrl(data.data.whatsappUrl))
      .catch(() => {});
  }, [id]);

  const advanceStatus = async () => {
    if (!order) return;
    const next = NEXT_STATUS[order.status];
    if (!next) return;

    setUpdating(true);
    try {
      const { data } = await api.patch(`/orders/${id}/status`, {
        status: next,
        merchantNotes: merchantNotes || undefined,
      });
      setOrder((o) => o ? { ...o, status: data.data.status } : o);
      toast.success(`Order marked as ${ORDER_STATUS_LABELS[next]}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const cancelOrder = async () => {
    if (!confirm('Cancel this order? This cannot be undone.')) return;
    setUpdating(true);
    try {
      await api.patch(`/orders/${id}/status`, { status: 'CANCELLED' });
      setOrder((o) => o ? { ...o, status: 'CANCELLED' } : o);
      toast.success('Order cancelled');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to cancel');
    } finally {
      setUpdating(false);
    }
  };

  const markPaid = async () => {
    setUpdating(true);
    try {
      await api.patch(`/orders/${id}/payment`, { paymentStatus: 'PAID' });
      setOrder((o) => o ? { ...o, paymentStatus: 'PAID' } : o);
      toast.success('Marked as paid');
    } catch {
      toast.error('Failed to update payment');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" className="text-[var(--brand)]" />
      </div>
    );
  }

  if (!order) return null;

  const nextStatus = NEXT_STATUS[order.status];
  const isTerminal = !nextStatus && order.status !== 'PENDING';

  return (
    <div className="space-y-6 animate-fade-up max-w-3xl">
      {/* Back + header */}
      <div>
        <Link href="/dashboard/orders" className="btn-ghost -ml-2 mb-3 inline-flex">
          <ArrowLeft className="w-4 h-4" /> Back to orders
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">
              {order.orderNumber}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Placed {formatDateTime(order.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={ORDER_STATUS_BADGE[order.status]}>
              {ORDER_STATUS_LABELS[order.status]}
            </span>
            <span className={PAYMENT_STATUS_BADGE[order.paymentStatus]}>
              {order.paymentStatus.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="card p-4 flex flex-wrap gap-3">
        {/* Primary advance */}
        {nextStatus && (
          <button
            onClick={advanceStatus}
            disabled={updating}
            className="btn-primary"
          >
            {updating ? <Spinner size="sm" /> : (
              <>
                {NEXT_STATUS_LABEL[nextStatus]}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}

        {/* Secondary action — e.g. PACKED can go to DISPATCHED (delivery)
            instead of READY (pickup/restaurant). Both are valid paths. */}
        {ALT_NEXT_STATUS[order.status] && (
          <button
            onClick={() => {
              const alt = ALT_NEXT_STATUS[order.status];
              if (!alt) return;
              setUpdating(true);
              api.patch(`/orders/${order.id}/status`, { status: alt.status })
                .then(() => setOrder((o) => o ? { ...o, status: alt.status } : o))
                .catch((err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed to update status'))
                .finally(() => setUpdating(false));
            }}
            disabled={updating}
            className="btn-secondary"
          >
            {ALT_NEXT_STATUS[order.status]?.label}
          </button>
        )}

        {/* Mark paid */}
        {order.paymentStatus === 'UNPAID' && (
          <button onClick={markPaid} disabled={updating} className="btn-secondary">
            Mark as Paid
          </button>
        )}

        {/* WhatsApp contact */}
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <MessageCircle className="w-4 h-4 text-[#25D366]" />
            Contact Customer on WhatsApp
          </a>
        )}

        {/* Cancel */}
        {!isTerminal && order.status !== 'CANCELLED' && (
          <button
            onClick={cancelOrder}
            disabled={updating}
            className="btn-ghost text-red-500 hover:text-red-600 hover:bg-red-50 ml-auto"
          >
            Cancel Order
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Order items */}
        <div className="card p-5 sm:col-span-2">
          <h2 className="font-display font-semibold text-[var(--text-primary)] mb-4">
            Items ({order.items.length})
          </h2>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{item.productName}</p>
                  {item.productSku && (
                    <p className="text-xs text-[var(--text-muted)]">SKU: {item.productSku}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{formatCurrency(item.lineTotal, order.currency)}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {item.quantity} × {formatCurrency(item.unitPrice, order.currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-1.5">
            <div className="flex justify-between text-sm text-[var(--text-secondary)]">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal, order.currency)}</span>
            </div>
            {parseFloat(order.discountAmount) > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Discount</span>
                <span>− {formatCurrency(order.discountAmount, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-[var(--text-primary)] pt-1">
              <span>Total</span>
              <span>{formatCurrency(order.total, order.currency)}</span>
            </div>
          </div>
        </div>

        {/* Customer */}
        <div className="card p-5">
          <h2 className="font-display font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <User className="w-4 h-4" /> Customer
          </h2>
          {order.customer ? (
            <div className="space-y-1.5 text-sm">
              {order.customer.fullName && (
                <p className="font-medium text-[var(--text-primary)]">{order.customer.fullName}</p>
              )}
              {order.customer.whatsappNumber && (
                <a
                  href={`https://wa.me/${order.customer.whatsappNumber.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[#25D366] hover:underline"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  {order.customer.whatsappNumber}
                </a>
              )}
              {order.customer.phone && !order.customer.whatsappNumber && (
                <p className="text-[var(--text-secondary)]">{order.customer.phone}</p>
              )}
              {order.customer.email && (
                <p className="text-[var(--text-secondary)]">{order.customer.email}</p>
              )}
              <Link
                href={`/dashboard/customers/${order.customer.id}`}
                className="text-xs text-[var(--brand)] hover:underline block mt-2"
              >
                View customer profile →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Guest order — no customer details</p>
          )}
        </div>

        {/* Fulfillment Details */}
        <div className="card p-5">
          <h2 className="font-display font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {order.fulfillmentType === 'PICKUP'  ? 'Pickup' :
             order.fulfillmentType === 'DINE_IN' ? 'Dine-In' :
             order.fulfillmentType === 'QUOTE'   ? 'Quote Request' :
             order.fulfillmentType === 'BOOKING' ? 'Booking' :
             'Delivery'}
          </h2>
          <dl className="space-y-2 text-sm">
            {order.deliveryAddress && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-muted)] mb-0.5">Address</dt>
                <dd className="text-[var(--text-secondary)]">{order.deliveryAddress}</dd>
              </div>
            )}
            {order.tableNumber && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-muted)] mb-0.5">Table</dt>
                <dd className="text-[var(--text-secondary)]">Table {order.tableNumber}</dd>
              </div>
            )}
            {order.scheduledFor && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-muted)] mb-0.5">
                  {order.fulfillmentType === 'BOOKING' ? 'Appointment' : 'Scheduled for'}
                </dt>
                <dd className="text-[var(--text-secondary)]">
                  {new Date(order.scheduledFor).toLocaleString('en-ZM', {
                    dateStyle: 'medium', timeStyle: 'short',
                  })}
                </dd>
              </div>
            )}
            {order.estimatedReadyAt && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-muted)] mb-0.5">Estimated ready</dt>
                <dd className="text-[var(--text-secondary)]">
                  {new Date(order.estimatedReadyAt).toLocaleString('en-ZM', {
                    dateStyle: 'medium', timeStyle: 'short',
                  })}
                </dd>
              </div>
            )}
            {!order.deliveryAddress && !order.tableNumber && !order.scheduledFor && (
              <dd className="text-[var(--text-muted)]">No additional details</dd>
            )}
          </dl>
          {order.notes && (
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Customer notes</p>
              <p className="text-sm text-[var(--text-secondary)]">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Merchant notes */}
        <div className="card p-5 sm:col-span-2">
          <h2 className="font-display font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Internal Notes
          </h2>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Add private notes about this order (not visible to customer)…"
            value={merchantNotes}
            onChange={(e) => setMerchantNotes(e.target.value)}
            onBlur={async () => {
              if (merchantNotes !== order.merchantNotes) {
                await api.patch(`/orders/${id}/status`, {
                  status: order.status,
                  merchantNotes,
                }).catch(() => {});
              }
            }}
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">Auto-saved when you click away</p>
        </div>
      </div>
    </div>
  );
}
