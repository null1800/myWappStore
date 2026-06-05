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
  deliveryAddress?: string;
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

    lines.push(`🛒 *New Order — ${order.storeName}*`);
    lines.push(`Order #${order.orderNumber}`);
    lines.push('─────────────────────');

    // Line items
    for (const item of order.items) {
      lines.push(
        `• ${item.name} × ${item.quantity} = ${order.currency} ${item.lineTotal}`,
      );
    }

    lines.push('─────────────────────');
    lines.push(`*Total: ${order.currency} ${order.total}*`);

    // Customer details if provided
    if (order.customerName) {
      lines.push('');
      lines.push(`👤 *Customer:* ${order.customerName}`);
    }

    if (order.deliveryAddress) {
      lines.push(`📍 *Deliver to:* ${order.deliveryAddress}`);
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
