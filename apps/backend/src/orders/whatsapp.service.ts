import { Injectable } from '@nestjs/common';

export interface WhatsAppOrderMessage {
  merchantPhone: string;
  storeName: string;
  orderNumber: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  subtotal: string;
  total: string;
  currency: string;
  customerName?: string;
  fulfillmentType?: string;  // DELIVERY | PICKUP | DINE_IN | QUOTE | BOOKING
  deliveryAddress?: string;
  tableNumber?: string;
  scheduledFor?: Date | null;
  notes?: string;
}

@Injectable()
export class WhatsAppService {

  // ── Generate wa.me checkout link ───────────────────────────────────────────
  // Produces a deep link that opens WhatsApp with a pre-filled order summary.
  // The customer just hits Send — the merchant receives the full order details.
  generateCheckoutLink(order: WhatsAppOrderMessage): string {
    const message = this.buildOrderMessage(order);
    const encodedMessage = encodeURIComponent(message);
    const cleanPhone = this.cleanPhoneNumber(order.merchantPhone);

    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  }

  // ── Build the formatted order message ─────────────────────────────────────
  buildOrderMessage(order: WhatsAppOrderMessage): string {
    const lines: string[] = [];

    const fulfillmentEmoji: Record<string, string> = {
      DELIVERY: '🚚',
      PICKUP:   '🏪',
      DINE_IN:  '🍽️',
      QUOTE:    '💬',
      BOOKING:  '📅',
    };
    const fulfillmentLabel: Record<string, string> = {
      DELIVERY: 'Delivery Order',
      PICKUP:   'Pickup Order',
      DINE_IN:  'Dine-In Order',
      QUOTE:    'Quote Request',
      BOOKING:  'Booking Request',
    };
    const type = order.fulfillmentType ?? 'DELIVERY';
    const emoji = fulfillmentEmoji[type] ?? '🛒';
    const label = fulfillmentLabel[type] ?? 'Order';

    lines.push(`${emoji} *${label} — ${order.storeName}*`);
    lines.push(`Order #${order.orderNumber}`);
    lines.push('─────────────────────');

    for (const item of order.items) {
      lines.push(
        `• ${item.name} × ${item.quantity} = ${order.currency} ${item.lineTotal}`,
      );
    }

    lines.push('─────────────────────');
    lines.push(`*Total: ${order.currency} ${order.total}*`);

    if (order.customerName) {
      lines.push('');
      lines.push(`👤 *Customer:* ${order.customerName}`);
    }

    // Fulfillment-specific details
    if (type === 'DINE_IN' && order.tableNumber) {
      lines.push(`🪑 *Table:* ${order.tableNumber}`);
    } else if (type === 'DELIVERY' && order.deliveryAddress) {
      lines.push(`📍 *Deliver to:* ${order.deliveryAddress}`);
    } else if ((type === 'PICKUP' || type === 'BOOKING') && order.scheduledFor) {
      const dt = new Date(order.scheduledFor);
      lines.push(`⏰ *${type === 'BOOKING' ? 'Appointment' : 'Pickup time'}:* ${dt.toLocaleString('en-ZM', { dateStyle: 'medium', timeStyle: 'short' })}`);
    }

    if (order.notes) {
      lines.push(`📝 *Notes:* ${order.notes}`);
    }

    lines.push('');
    lines.push('_Sent via MyWAppStore_');

    return lines.join('\n');
  }

  // ── Validate WhatsApp phone number ─────────────────────────────────────────
  // wa.me requires E.164 format without the + sign
  // Examples: +260977000001 → 260977000001
  private cleanPhoneNumber(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }

  // ── Build order status update message (Phase 2 — WA Business API) ─────────
  // Returns a formatted message to send to the customer when order status changes
  buildStatusUpdateMessage(
    orderNumber: string,
    status: string,
    storeName: string,
  ): string {
    const statusMessages: Record<string, string> = {
      CONFIRMED: `✅ Your order #${orderNumber} has been confirmed by ${storeName}. We'll let you know when it's packed.`,
      PACKED: `📦 Your order #${orderNumber} is packed and ready. Delivery is being arranged.`,
      DISPATCHED: `🚚 Your order #${orderNumber} is on the way! Expect delivery soon.`,
      DELIVERED: `🎉 Your order #${orderNumber} has been delivered. Thank you for shopping with ${storeName}!`,
      CANCELLED: `❌ Your order #${orderNumber} has been cancelled. Please contact ${storeName} for assistance.`,
    };

    return (
      statusMessages[status] ??
      `Your order #${orderNumber} status has been updated to: ${status}`
    );
  }
}
