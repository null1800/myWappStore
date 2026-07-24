export interface StoreInfo {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  phoneWhatsapp: string | null;
  isPublic: boolean;
  isActive: boolean;
  businessType: string;
  theme: string;
  headline: string | null;
  subtitle: string | null;
  aboutText: string | null;
  address: string | null;
  contactEmail: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  price: string;
  compareAtPrice: string | null;
  images: string[];
  stockQuantity: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  status: string;
  category: { id: string; name: string } | null;
  tags?: string[];
  description?: string | null;
}

export interface StorefrontClientProps {
  storeSlug: string;
  store: StoreInfo;
  products: Product[];
}

export interface ProductAttributes {
  colors: Array<{ name: string; hex: string }>;
  sizes: string[];
  customAttributes: Array<{ name: string; values: string[] }>;
  dynamicFields?: Record<string, string>;
}

export interface CartItemInput {
  productId: string;
  name: string;
  price: string;
  image: string | null;
  maxStock: number;
  allowBackorder: boolean;
  selectedColor?: { name: string; hex: string };
}

export interface ProductCardProps {
  product: Product;
  storeSlug: string;
  store: StoreInfo;
  brandColor: string;
  mounted: boolean;
  wishlist: Set<string>;
  toggleWishlist: (id: string, name: string) => void;
  addItem: (item: CartItemInput, storeSlug: string) => void;
  updateQty: (id: string, qty: number) => void;
  getItem: (id: string) => { quantity: number } | undefined;
}
