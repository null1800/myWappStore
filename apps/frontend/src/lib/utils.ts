export function formatCurrency(value: string | number, currency: string = 'ZMW') {
  const amount = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(amount) || amount === null) return '—';
  try {
    return new Intl.NumberFormat('en-ZM', {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateStr: string) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getInitials(name: string) {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatRelative(dateStr: string) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export function getStockStatus(stockQty: number, trackInventory: boolean) {
  if (!trackInventory) {
    return { label: 'In stock', class: 'badge-green' };
  }
  if (stockQty === 0) {
    return { label: 'Out of stock', class: 'badge-red' };
  }
  if (stockQty <= 5) {
    return { label: 'Low stock', class: 'badge-amber' };
  }
  return { label: 'In stock', class: 'badge-green' };
}

export function generateSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING:    'Pending',
  CONFIRMED:  'Confirmed',
  PACKED:     'Packed',
  READY:      'Ready',
  DISPATCHED: 'Dispatched',
  DELIVERED:  'Delivered',
  CANCELLED:  'Cancelled',
  REFUNDED:   'Refunded',
  QUOTE_SENT: 'Quote Sent',
  BOOKED:     'Booked',
};

export const ORDER_STATUS_BADGE: Record<string, string> = {
  PENDING:    'badge badge-gray',
  CONFIRMED:  'badge badge-blue',
  PACKED:     'badge badge-amber',
  READY:      'badge badge-green',
  DISPATCHED: 'badge badge-amber',
  DELIVERED:  'badge badge-green',
  CANCELLED:  'badge badge-red',
  REFUNDED:   'badge badge-red',
  QUOTE_SENT: 'badge badge-blue',
  BOOKED:     'badge badge-blue',
};

export const PAYMENT_STATUS_BADGE: Record<string, string> = {
  UNPAID: 'badge badge-red',
  PAID: 'badge badge-green',
  PARTIALLY_PAID: 'badge badge-amber',
  REFUNDED: 'badge badge-red',
};

export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
