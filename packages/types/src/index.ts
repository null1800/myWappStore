// ─── API Response Envelope ────────────────────────────────────────────────────
// Matches the shape returned by TransformInterceptor and HttpExceptionFilter

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  meta: PaginationMeta | null;
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
  details: Record<string, unknown>;
  path: string;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Enums (mirror Prisma enums for frontend use) ─────────────────────────────

export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'STAFF';

export type ProductStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PACKED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentStatus = 'UNPAID' | 'PAID' | 'PARTIALLY_PAID' | 'REFUNDED';

// ─── Entity Types ─────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  email: string;
  phoneWhatsapp: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  description: string | null;
  isActive: boolean;
  isPublic: boolean;
  plan: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  authId: string;
  tenantId: string | null;
  email: string;
  fullName: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  tenantId: string;
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: string;            // Decimal comes back as string from JSON
  compareAtPrice: string | null;
  sku: string | null;
  stockQuantity: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  status: ProductStatus;
  images: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  tenantId: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  totalOrders: number;
  totalSpent: string;
  createdAt: string;
}

export interface Order {
  id: string;
  tenantId: string;
  customerId: string | null;
  orderNumber: string;
  status: OrderStatus;
  subtotal: string;
  discountAmount: string;
  total: string;
  currency: string;
  paymentMethod: string | null;
  paymentStatus: PaymentStatus;
  deliveryAddress: string | null;
  notes: string | null;
  merchantNotes: string | null;
  whatsappSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  customer?: Customer | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  productSku: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;        // user UUID
  tenantId: string;   // tenant UUID
  role: UserRole;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface AuthUser {
  user: User;
  tenant: Tenant | null;
  tokens: AuthTokens;
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

export interface WhatsAppCheckoutPayload {
  storeSlug: string;
  merchantWhatsApp: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  total: string;
  currency: string;
  deliveryAddress?: string;
  customerNotes?: string;
}
