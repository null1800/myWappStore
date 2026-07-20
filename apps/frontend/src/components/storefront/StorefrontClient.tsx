'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ShoppingBag,
  MessageCircle,
  Star,
  ShieldCheck,
  Truck,
  Search,
  Sparkles,
  HeartHandshake,
  Mail,
  MapPin,
  Instagram,
  Facebook,
  Plus,
  Minus,
  ShoppingCart,
  Heart,
  ChevronUp,
  X,
  Zap,
  Package,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Flame,
  Leaf,
  Utensils,
  Pill,
  TrendingUp,
  Award,
  Send,
  BarChart3,
  Grid3x3,
  Clock3,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { StorefrontCartButton } from '@/components/storefront/StorefrontCartButton';
import { CartDrawer, useCartDrawerStore } from '@/components/storefront/CartDrawer';
import { useCartStore } from '@/store/cart.store';
import { toast } from 'sonner';
import { parseStorefrontConfig, StorefrontConfig, StorefrontSection } from '@/lib/storefront-config';
import {
  ProductCardCarousel as ExtractedProductCardCarousel,
  ProductCardCollage as ExtractedProductCardCollage,
  ProductCardMagazine as ExtractedProductCardMagazine,
  ProductCardSpotlight as ExtractedProductCardSpotlight,
  ProductCardStandard as ExtractedProductCardStandard,
} from './StorefrontProductCards';
import { StorefrontTrustBar } from './StorefrontTrustBar';

interface StoreInfo {
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

interface Product {
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

interface StorefrontClientProps {
  storeSlug: string;
  store: StoreInfo;
  products: Product[];
}

const PREDEFINED_DISPLAY_TYPES: Record<string, { label: string; class: string }> = {
  'featured': { label: 'Featured', class: 'bg-amber-400/90 text-amber-950' },
  'best seller': { label: 'Best Seller', class: 'bg-orange-500/90 text-white' },
  'new arrival': { label: 'New Arrival', class: 'bg-blue-500/90 text-white' },
  'latest': { label: 'Latest', class: 'bg-emerald-500/90 text-white' },
  'most popular': { label: 'Most Popular', class: 'bg-purple-500/90 text-white' },
  'recommended': { label: 'Recommended', class: 'bg-teal-500/90 text-white' },
  'on sale': { label: 'On Sale', class: 'bg-red-500/90 text-white' },
  'limited edition': { label: 'Limited Edition', class: 'bg-indigo-600/90 text-white font-black' },
};

// Product attribute parsing helpers
interface ProductAttributes {
  colors: Array<{ name: string; hex: string }>;
  sizes: string[];
  customAttributes: Array<{ name: string; values: string[] }>;
}

function parseProductAttributes(tags?: string[]): ProductAttributes {
  if (!tags) return { colors: [], sizes: [], customAttributes: [] };
  const metaTag = tags.find(t => t.startsWith('__meta:'));
  if (!metaTag) return { colors: [], sizes: [], customAttributes: [] };
  
  try {
    const jsonStr = metaTag.replace('__meta:', '');
    return JSON.parse(jsonStr);
  } catch {
    return { colors: [], sizes: [], customAttributes: [] };
  }
}

// ─── Product Card Components ──────────────────────────────────────────────────

interface CartItemInput {
  productId: string;
  name: string;
  price: string;
  image: string | null;
  maxStock: number;
  allowBackorder: boolean;
  selectedColor?: { name: string; hex: string };
}

interface ProductCardProps {
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

function BusinessTypeBadges({ businessType, attributes }: { businessType: string; attributes: ProductAttributes }) {
  const badges: React.ReactNode[] = [];
  
  if (businessType === 'RESTAURANT') {
    const spicyLevel = attributes.customAttributes.find(a => a.name.toLowerCase().includes('spice'));
    if (spicyLevel) {
      badges.push(<span key="spicy" className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Flame className="w-3 h-3" /> Spicy</span>);
    }
    const veg = attributes.customAttributes.find(a => a.name.toLowerCase().includes('veg') || a.values.some(v => v.toLowerCase().includes('veg')));
    if (veg) {
      badges.push(<span key="veg" className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Leaf className="w-3 h-3" /> Veg</span>);
    }
    const nonVeg = attributes.customAttributes.find(a => a.values.some(v => v.toLowerCase().includes('non-veg') || v.toLowerCase().includes('meat')));
    if (nonVeg) {
      badges.push(<span key="nonveg" className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Utensils className="w-3 h-3" /> Non-Veg</span>);
    }
  }
  
  if (businessType === 'PHARMACY') {
    const dosage = attributes.customAttributes.find(a => a.name.toLowerCase().includes('dosage') || a.name.toLowerCase().includes('form'));
    if (dosage) {
      badges.push(<span key="dosage" className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Pill className="w-3 h-3" /> {dosage.values[0]}</span>);
    }
  }
  
  return badges.length > 0 ? <div className="flex flex-wrap gap-1.5 mt-2">{badges}</div> : null;
}

function ProductAttributeDisplay({ attributes, businessType, selectedColor, onColorSelect }: { 
  attributes: ProductAttributes; 
  businessType: string;
  selectedColor?: { name: string; hex: string };
  onColorSelect?: (color: { name: string; hex: string }) => void;
}) {
  if (attributes.colors.length === 0 && attributes.sizes.length === 0 && attributes.customAttributes.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      {attributes.colors.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Colors:</span>
          <div className="flex gap-1">
            {attributes.colors.slice(0, 5).map((color, idx) => (
              <button
                key={idx}
                onClick={() => onColorSelect?.(color)}
                className={`w-5 h-5 rounded-full border-2 shadow-sm hover:scale-110 transition-transform ${
                  selectedColor?.name === color.name ? 'border-slate-900 ring-2 ring-slate-300' : 'border-white'
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
            {attributes.colors.length > 5 && (
              <span className="text-[10px] text-slate-400">+{attributes.colors.length - 5}</span>
            )}
          </div>
        </div>
      )}
      
      {(businessType === 'RETAIL' || businessType === 'CLOTHING' || businessType === 'SHOES') && attributes.sizes.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Sizes:</span>
          <div className="flex gap-1 flex-wrap">
            {attributes.sizes.slice(0, 4).map((size, idx) => (
              <span key={idx} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{size}</span>
            ))}
            {attributes.sizes.length > 4 && (
              <span className="text-[10px] text-slate-400">+{attributes.sizes.length - 4}</span>
            )}
          </div>
        </div>
      )}
      
      {businessType === 'RESTAURANT' && attributes.sizes.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Portions:</span>
          <div className="flex gap-1 flex-wrap">
            {attributes.sizes.map((size, idx) => (
              <span key={idx} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{size}</span>
            ))}
          </div>
        </div>
      )}

      {attributes.customAttributes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {attributes.customAttributes.slice(0, 3).map((attr, idx) => (
            <span key={idx} className="text-[10px] rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
              {attr.name}: {attr.values[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCardStandard({ product, storeSlug, store, mounted, wishlist, toggleWishlist, addItem, updateQty, getItem }: ProductCardProps) {
  const attributes = parseProductAttributes(product.tags);
  const [selectedColor, setSelectedColor] = useState<{ name: string; hex: string } | undefined>(
    attributes.colors.length > 0 ? attributes.colors[0] : undefined
  );
  const isOutOfStock = product.trackInventory && !product.allowBackorder && product.stockQuantity === 0;
  const discount = product.compareAtPrice
    ? Math.round((1 - parseFloat(product.price) / parseFloat(product.compareAtPrice)) * 100)
    : null;
  const displayBadge = product.tags?.map((t) => t.toLowerCase()).find((t) => t in PREDEFINED_DISPLAY_TYPES);
  const inCart = getItem(product.id);
  const isWishlisted = wishlist.has(product.id);

  return (
    <div className={`group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-[var(--brand)] transition-all duration-300 hover:shadow-[0_0_24px_rgba(15,110,86,0.06)] ${isOutOfStock ? 'opacity-60' : ''}`}>
      <div className="relative aspect-[4/5] overflow-hidden bg-slate-50">
        <Link href={`/${storeSlug}/products/${product.slug}`}>
          {product.images?.[0] ? (
            <Image src={product.images[0]} alt={product.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 640px) 50vw, 25vw" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-5xl">📦</div>
          )}
        </Link>
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2 pointer-events-none">
          {discount && discount > 0 && (
            <span className="rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-black text-white shadow-lg">-{discount}%</span>
          )}
          {displayBadge && (
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black text-white shadow-lg ${PREDEFINED_DISPLAY_TYPES[displayBadge]?.class || 'bg-slate-500'}`}>
              {PREDEFINED_DISPLAY_TYPES[displayBadge]?.label}
            </span>
          )}
        </div>
        <div className="absolute inset-x-3 top-3 flex items-start justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-auto">
          <button onClick={() => toggleWishlist(product.id, product.name)} className={`p-2 rounded-full shadow-lg backdrop-blur bg-white/90 border border-slate-200 transition-all hover:scale-110 ${isWishlisted ? 'text-rose-500' : 'text-slate-400'}`}>
            <Heart className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.category && (
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--brand)] font-mono">{product.category.name}</p>
        )}
        <Link href={`/${storeSlug}/products/${product.slug}`} className="line-clamp-2 flex-1 text-sm font-bold leading-5 text-slate-900 sm:text-base hover:text-[var(--brand)] transition-colors block">
          {product.name}
        </Link>
        <BusinessTypeBadges businessType={store.businessType} attributes={attributes} />
        <ProductAttributeDisplay 
          attributes={attributes} 
          businessType={store.businessType} 
          selectedColor={selectedColor}
          onColorSelect={setSelectedColor}
        />
        {store.businessType === 'RESTAURANT' && (
          <div className="mt-2 flex flex-wrap gap-1">
            {['Dine-In', 'Delivery', 'Pickup'].map((option) => (
              <span key={option} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{option}</span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-base font-black text-[var(--brand)]">{formatCurrency(product.price)}</span>
          {mounted && inCart ? (
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-full p-0.5">
              <button onClick={() => updateQty(product.id, inCart.quantity - 1)} className="p-1 rounded-full hover:bg-slate-200 text-slate-600"><Minus className="w-3 h-3" /></button>
              <span className="text-xs font-bold px-1.5 text-slate-900">{inCart.quantity}</span>
              <button onClick={() => updateQty(product.id, inCart.quantity + 1)} disabled={!product.allowBackorder && inCart.quantity >= product.stockQuantity} className="p-1 rounded-full hover:bg-slate-200 text-slate-600"><Plus className="w-3 h-3" /></button>
            </div>
          ) : (
            <button
              onClick={() => {
                addItem({ 
                  productId: product.id, 
                  name: product.name, 
                  price: product.price, 
                  image: product.images?.[0] || null, 
                  maxStock: product.stockQuantity, 
                  allowBackorder: product.allowBackorder,
                  selectedColor 
                }, storeSlug);
              }}
              className="p-2 rounded-full bg-[var(--brand)] text-white hover:opacity-90 transition-transform active:scale-95"
              aria-label={`Add ${product.name} to cart`}
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCardCarousel({ products, ...props }: Omit<ProductCardProps, 'product'> & { products: Product[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const scrollAmount = containerRef.current.clientWidth * 0.8;
      containerRef.current.scrollBy({ left: direction === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2 mb-4">
        <button onClick={() => scroll('left')} className="p-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={() => scroll('right')} className="p-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div ref={containerRef} className="flex gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-4">
        {products.map((product) => (
          <div key={product.id} className="snap-start shrink-0 w-[280px]">
            <ProductCardStandard {...props} product={product} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductCardCollage({ products, ...props }: Omit<ProductCardProps, 'product'> & { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-[200px]">
      {products.map((product, idx) => {
        const isLarge = idx === 0;
        return (
          <div key={product.id} className={`${isLarge ? 'col-span-2 row-span-2' : ''} relative overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-[var(--brand)] transition-all group`}>
            <Link href={`/${props.storeSlug}/products/${product.slug}`} className="absolute inset-0">
              {product.images?.[0] ? (
                <Image src={product.images[0]} alt={product.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-4xl bg-slate-50">📦</div>
              )}
            </Link>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
              <p className="text-white font-bold text-sm line-clamp-1">{product.name}</p>
              <p className="text-white/90 text-xs font-mono">{formatCurrency(product.price)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProductCardMagazine({ products, ...props }: Omit<ProductCardProps, 'product'> & { products: Product[] }) {
  if (products.length === 0) return null;
  const [featured, ...sideProducts] = products;

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-white hover:border-[var(--brand)] transition-all group">
        <Link href={`/${props.storeSlug}/products/${featured.slug}`} className="block">
          <div className="aspect-[16/9] relative">
            {featured.images?.[0] ? (
              <Image src={featured.images[0]} alt={featured.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-6xl bg-slate-50">📦</div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2">Featured</p>
              <h3 className="text-white font-black text-2xl sm:text-3xl line-clamp-2 mb-2">{featured.name}</h3>
              <p className="text-white/90 text-sm line-clamp-2 mb-4">{featured.description}</p>
              <div className="flex items-center gap-3">
                <span className="text-white font-black text-xl">{formatCurrency(featured.price)}</span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    props.addItem({ productId: featured.id, name: featured.name, price: featured.price, image: featured.images?.[0] || null, maxStock: featured.stockQuantity, allowBackorder: featured.allowBackorder }, props.storeSlug);
                  }}
                  className="px-4 py-2 bg-white text-slate-900 rounded-full font-bold text-sm hover:bg-slate-100 transition-colors"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Side cards */}
      <div className="grid grid-cols-2 gap-4">
        {sideProducts.slice(0, 4).map((product) => (
          <ProductCardStandard key={product.id} {...props} product={product} />
        ))}
      </div>
    </div>
  );
}

function ProductCardSpotlight({ product, store, ...props }: ProductCardProps) {
  const attributes = parseProductAttributes(product.tags);
  const [selectedColor, setSelectedColor] = useState<{ name: string; hex: string } | undefined>(
    attributes.colors.length > 0 ? attributes.colors[0] : undefined
  );
  const isOutOfStock = product.trackInventory && !product.allowBackorder && product.stockQuantity === 0;
  const discount = product.compareAtPrice
    ? Math.round((1 - parseFloat(product.price) / parseFloat(product.compareAtPrice)) * 100)
    : null;

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 bg-white hover:border-[var(--brand)] transition-all group ${isOutOfStock ? 'opacity-60' : ''}`}>
      <Link href={`/${props.storeSlug}/products/${product.slug}`} className="block">
        <div className="aspect-[21/9] relative">
          {product.images?.[0] ? (
            <Image src={product.images[0]} alt={product.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-6xl bg-slate-50">📦</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          <div className="absolute inset-0 p-8 flex flex-col justify-center">
            {product.category && (
              <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2">{product.category.name}</p>
            )}
            <h3 className="text-white font-black text-2xl sm:text-3xl line-clamp-2 mb-2">{product.name}</h3>
            <p className="text-white/90 text-sm line-clamp-2 mb-4 max-w-lg">{product.description}</p>
            <BusinessTypeBadges businessType={store.businessType} attributes={attributes} />
            <ProductAttributeDisplay 
              attributes={attributes} 
              businessType={store.businessType} 
              selectedColor={selectedColor}
              onColorSelect={setSelectedColor}
            />
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <span className="text-white font-black text-2xl">{formatCurrency(product.price)}</span>
                {discount && discount > 0 && (
                  <span className="text-white/60 line-through">{formatCurrency(product.compareAtPrice!)}</span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  props.addItem({ 
                    productId: product.id, 
                    name: product.name, 
                    price: product.price, 
                    image: product.images?.[0] || null, 
                    maxStock: product.stockQuantity, 
                    allowBackorder: product.allowBackorder,
                    selectedColor 
                  }, props.storeSlug);
                }}
                className="px-6 py-3 bg-[var(--brand)] text-white rounded-full font-bold text-sm hover:opacity-90 transition-colors"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

// ─── Trust Bar ────────────────────────────────────────────────────────────

function ArtechTrustBar() {
  const items = [
    { Icon: ShieldCheck, title: 'Secure Checkout', sub: 'Encrypted & safe' },
    { Icon: Truck, title: 'Fast Delivery', sub: 'Order via WhatsApp' },
    { Icon: HeartHandshake, title: '24/7 Support', sub: 'Direct chat access' },
    { Icon: Sparkles, title: 'Quality Assured', sub: 'Curated catalog' },
  ];
  return (
    <section className="py-10 border-y border-slate-200 bg-white" aria-label="Store trust signals">
      <div className="container-page flex flex-wrap justify-center md:justify-between gap-6 items-center">
        {items.map(({ Icon, title, sub }) => (
          <div key={title} className="flex items-center gap-4 group">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 transition-colors group-hover:border-[var(--brand)]">
              <Icon className="w-6 h-6 text-[var(--brand)]" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">{title}</p>
              <p className="text-xs text-slate-500">{sub}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────────

export function StorefrontClient({ storeSlug, store, products }: StorefrontClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<string>('featured');
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { addItem, getItem, updateQty, items } = useCartStore();
  const openCart = useCartDrawerStore((s) => s.open);

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = items.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0);

  // Parse custom dynamic store builder config
  const builderConfig = useMemo(() => parseStorefrontConfig(store), [store]);

  const brandColor = useMemo(() => {
    return store.primaryColor === '#0F6E56' ? '#b0db60' : store.primaryColor;
  }, [store.primaryColor]);

  // Scroll effects
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 600);
      setNavScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Set mounted after client-side hydration
  useEffect(() => {
    const timeout = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  // Load wishlist from localStorage
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`wishlist-${storeSlug}`);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        setWishlist(new Set(parsed));
      }
    } catch {}
  }, [storeSlug]);

  const toggleWishlist = useCallback((productId: string, productName: string) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
        toast('Removed from wishlist', { description: productName });
      } else {
        next.add(productId);
        toast.success('Added to wishlist ❤️', { description: productName });
      }
      try { localStorage.setItem(`wishlist-${storeSlug}`, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, [storeSlug]);


  const categories = useMemo(() => {
    return Array.from(
      new Map(
        products.filter((p) => p.category).map((p) => [p.category!.id, p.category!])
      ).values()
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products.filter((product) => {
      const matchesCategory = selectedCategoryId ? product.category?.id === selectedCategoryId : true;
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.category?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    if (sortBy === 'price-asc') result = [...result].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    else if (sortBy === 'price-desc') result = [...result].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    else if (sortBy === 'name-asc') result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'wishlist') result = [...result].filter((p) => wishlist.has(p.id));

    return result;
  }, [products, selectedCategoryId, searchQuery, sortBy, wishlist]);

  const handleWhatsappMessage = useCallback(() => {
    if (!store.phoneWhatsapp) return '';
    const text = encodeURIComponent(
      `Hello ${store.name}! I am browsing your store and would like to ask a question.`
    );
    return `https://wa.me/${store.phoneWhatsapp.replace(/[^0-9]/g, '')}?text=${text}`;
  }, [store.name, store.phoneWhatsapp]);

  const getProductsForSection = (sectionFilter?: string) => {
    let result = [...filteredProducts];
    if (sectionFilter === 'featured') {
      result = result.filter((p) => p.tags?.some((tag) => tag.toLowerCase() === 'featured'));
    } else if (sectionFilter === 'trending') {
      result = result.filter((p) => p.tags?.some((tag) => ['most popular', 'trending'].includes(tag.toLowerCase())));
    } else if (sectionFilter === 'best-sellers') {
      result = result.filter((p) => p.tags?.some((tag) => ['best seller', 'best-sellers'].includes(tag.toLowerCase())));
    }
    return result;
  };

  return (
    <div
      className="artech-storefront min-h-screen text-slate-900 bg-white font-sans selection:bg-[var(--brand)] selection:text-white"
      style={{
        '--brand': brandColor,
        fontFamily: 'Inter, system-ui, sans-serif',
      } as React.CSSProperties}
    >

      {/* ── Dynamic Announcement Bar ── */}
      {builderConfig.announcement?.enabled && (
        <div
          className="relative z-[60] py-2 text-center text-xs font-bold tracking-wider uppercase border-b border-[#0066CC]/20"
          style={{
            background: 'linear-gradient(90deg, #f0f9ff, #f0fdf4, #f0f9ff)',
            color: '#0f6e56',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {builderConfig.announcement.link ? (
            <Link href={builderConfig.announcement.link} className="hover:underline flex items-center justify-center gap-1.5">
              <Zap className="w-3 h-3" style={{ color: brandColor }} />
              {builderConfig.announcement.text}
              <Zap className="w-3 h-3" style={{ color: brandColor }} />
            </Link>
          ) : (
            <div className="flex items-center justify-center gap-1.5">
              <Zap className="w-3 h-3" style={{ color: brandColor }} />
              {builderConfig.announcement.text}
              <Zap className="w-3 h-3" style={{ color: brandColor }} />
            </div>
          )}
        </div>
      )}

      {/* ── Fixed Glass Navbar ── */}
      <nav
        className="fixed left-0 w-full z-50 border-b border-slate-200/50 bg-white/70 artech-glass transition-all duration-300"
        style={{
          top: builderConfig.announcement?.enabled ? '32px' : '0',
          ...(navScrolled ? { boxShadow: `0 1px 32px rgba(0,0,0,0.1)`, background: 'white/90' } : {})
        }}
      >
        <div className="container-page flex items-center justify-between py-3 gap-4">
          <Link href={`/${storeSlug}`} className="flex items-center gap-3 min-w-0 shrink-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
              {builderConfig.navigation?.logoUrl ? (
                <Image src={builderConfig.navigation.logoUrl} alt={store.name} width={40} height={40} className="h-full w-full object-cover" />
              ) : store.logoUrl ? (
                <Image src={store.logoUrl} alt={store.name} width={40} height={40} className="h-full w-full object-cover" />
              ) : (
                <ShoppingBag className="h-5 w-5" style={{ color: brandColor }} />
              )}
            </div>
            <div className="min-w-0 hidden sm:block">
              <p className="truncate text-sm font-bold text-slate-900 font-display">
                {store.name}
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                Secure WhatsApp store
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {wishlist.size > 0 && (
              <button
                onClick={() => setSortBy(sortBy === 'wishlist' ? 'featured' : 'wishlist')}
                className="relative hidden sm:flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
                aria-label={`View ${wishlist.size} wishlisted items`}
              >
                <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
                <span>{wishlist.size}</span>
              </button>
            )}

            {builderConfig.navigation?.whatsappEnabled && store.phoneWhatsapp && (
              <a
                href={handleWhatsappMessage()}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all font-mono"
              >
                <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
                Ask a question
              </a>
            )}

            <StorefrontCartButton />
          </div>
        </div>
      </nav>

      {/* ── Dynamic Hero Section ── */}
      {builderConfig.hero?.enabled && (
        <div style={{ paddingTop: builderConfig.announcement?.enabled ? '88px' : '56px' }}>
          <section className="relative overflow-hidden bg-white min-h-[70vh] flex items-center" aria-label="Store hero">
            <div
              className="pointer-events-none absolute inset-0 z-0"
              aria-hidden="true"
              style={{
                background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${brandColor}12 0%, transparent 70%)`,
              }}
            />
            <div className="pointer-events-none absolute inset-0 z-0 artech-grid-bg" aria-hidden="true" />

            <div className="relative z-10 container-page w-full py-16 sm:py-24">
              <div className={`max-w-3xl space-y-6 mx-auto ${
                builderConfig.hero.position === 'left' ? 'text-left mr-auto ml-0' :
                builderConfig.hero.position === 'right' ? 'text-right ml-auto mr-0' :
                'text-center'
              }`}>
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-bold uppercase tracking-widest font-mono"
                  style={{
                    background: `${brandColor}12`,
                    borderColor: `${brandColor}30`,
                    color: brandColor,
                  }}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Shop Premium • WhatsApp Delivery</span>
                </div>

                <h1 className="font-black leading-[1.1] tracking-tight text-slate-900 text-3xl sm:text-5xl lg:text-6xl font-display">
                  {builderConfig.hero.heading}
                </h1>

                <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto leading-relaxed">
                  {builderConfig.hero.subheading}
                </p>

                <div className={`flex flex-wrap gap-4 items-center ${
                  builderConfig.hero.position === 'left' ? 'justify-start' :
                  builderConfig.hero.position === 'right' ? 'justify-end' :
                  'justify-center'
                }`}>
                  {builderConfig.hero.ctaLink && (
                    <a
                      href={builderConfig.hero.ctaLink}
                      className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm transition-all hover:opacity-90 active:scale-95 shadow-lg bg-[var(--brand)] text-[#243600] font-mono"
                      style={{ boxShadow: `0 8px 24px ${brandColor}30` }}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      {builderConfig.hero.ctaText}
                    </a>
                  )}

                  {store.phoneWhatsapp && (
                    <a
                      href={handleWhatsappMessage()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm border border-slate-200 text-slate-700 transition-all hover:bg-slate-50 active:scale-95 font-mono"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                      WHATSAPP CHAT
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── Trust Bar ── */}
      <StorefrontTrustBar />

      {/* ── Category & Search Sticky Filter Bar ── */}
      <div
        className="sticky top-[56px] z-20 border-b border-slate-200/50 bg-white/85 artech-glass"
        style={{ top: builderConfig.announcement?.enabled ? '88px' : '56px' }}
        role="navigation"
        aria-label="Product filter navigation"
      >
        <div className="container-page flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
            <button
              onClick={() => { setSelectedCategoryId(null); if (sortBy === 'wishlist') setSortBy('featured'); }}
              aria-pressed={!selectedCategoryId && sortBy !== 'wishlist'}
              className={`${!selectedCategoryId && sortBy !== 'wishlist' ? 'artech-chip artech-chip-active' : 'artech-chip'}`}
            >
              All products
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                aria-pressed={selectedCategoryId === cat.id}
                className={`${selectedCategoryId === cat.id ? 'artech-chip artech-chip-active' : 'artech-chip'}`}
              >
                {cat.name}
              </button>
            ))}
            {wishlist.size > 0 && (
              <button
                onClick={() => { setSelectedCategoryId(null); setSortBy(sortBy === 'wishlist' ? 'featured' : 'wishlist'); }}
                aria-pressed={sortBy === 'wishlist'}
                className={`${sortBy === 'wishlist' ? 'artech-chip artech-chip-active' : 'artech-chip'} flex items-center gap-1.5`}
              >
                <Heart className="w-3 h-3" />
                Saved ({wishlist.size})
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {builderConfig.navigation?.searchEnabled && (
              <div className="relative flex items-center flex-1 md:flex-initial min-w-[140px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-full text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/30 transition-all font-mono"
                  placeholder="Search catalog..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search catalog"
                  type="search"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-0.5 shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-slate-100 text-[var(--brand)]' : 'text-slate-400 hover:text-slate-600'}`}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-slate-100 text-[var(--brand)]' : 'text-slate-400 hover:text-slate-600'}`}
                aria-label="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dynamic CMS Content Sections ── */}
      <main id="products" className="py-12 sm:py-16">
        {builderConfig.sections?.map((section) => {
          if (!section.enabled) return null;

          if (section.type === 'products') {
            const sectionProducts = getProductsForSection(section.filter).slice(0, section.limit || 8);
            const cardLayout = section.cardLayout || 'grid';
            const cardProps = {
              storeSlug,
              store,
              brandColor,
              mounted,
              wishlist,
              toggleWishlist,
              addItem,
              updateQty,
              getItem,
            };

            return (
              <section key={section.id} className="container-page mb-16" aria-label={section.title}>
                <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand)] font-mono">{section.subtitle || 'Catalog'}</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl font-display">{section.title}</h2>
                  </div>
                  <BusinessTypeBadges businessType={store.businessType} attributes={{ colors: [], sizes: [], customAttributes: [] }} />
                </div>

                {sectionProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
                    <ShoppingBag className="mb-4 h-12 w-12 text-slate-400" />
                    <h3 className="text-lg font-bold text-slate-900">No products found</h3>
                    <p className="mt-1 text-sm text-slate-500">Try adjusting your search filters.</p>
                  </div>
                ) : cardLayout === 'carousel' ? (
                  <ExtractedProductCardCarousel products={sectionProducts} {...cardProps} />
                ) : cardLayout === 'collage' ? (
                  <ExtractedProductCardCollage products={sectionProducts} {...cardProps} />
                ) : cardLayout === 'magazine' ? (
                  <ExtractedProductCardMagazine products={sectionProducts} {...cardProps} />
                ) : cardLayout === 'spotlight' && sectionProducts.length > 0 ? (
                  <ExtractedProductCardSpotlight product={sectionProducts[0]} {...cardProps} />
                ) : cardLayout === 'list' ? (
                  <div className="flex flex-col gap-4">
                    {sectionProducts.map((product) => {
                      const isOutOfStock = product.trackInventory && !product.allowBackorder && product.stockQuantity === 0;
                      const isWishlisted = wishlist.has(product.id);
                      return (
                        <div
                          key={product.id}
                          className={`group flex flex-row items-center p-4 gap-4 rounded-xl border border-slate-200 bg-white hover:border-[var(--brand)] transition-all duration-300 ${isOutOfStock ? 'opacity-60' : ''}`}
                        >
                          <div className="relative w-24 h-24 sm:w-32 sm:h-32 overflow-hidden bg-slate-50 rounded-xl shrink-0">
                            <Link href={`/${storeSlug}/products/${product.slug}`}>
                              {product.images?.[0] ? (
                                <Image src={product.images[0]} alt={product.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="128px" />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-3xl">📦</div>
                              )}
                            </Link>
                          </div>
                          <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                            <div>
                              {product.category && (
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--brand)] font-mono">
                                  {product.category.name}
                                </p>
                              )}
                              <Link href={`/${storeSlug}/products/${product.slug}`} className="line-clamp-2 text-sm sm:text-base font-bold text-slate-900 hover:text-[var(--brand)] transition-colors mt-0.5 block">
                                {product.name}
                              </Link>
                              <ProductAttributeDisplay attributes={parseProductAttributes(product.tags)} businessType={store.businessType} />
                            </div>
                            <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                              <span className="text-base font-black text-[var(--brand)]">{formatCurrency(product.price)}</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => toggleWishlist(product.id, product.name)} className={`p-2 rounded-full transition-all ${isWishlisted ? 'text-rose-500' : 'text-slate-400 hover:text-rose-400'}`}>
                                  <Heart className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:gap-5">
                    {sectionProducts.map((product) => (
                      <ExtractedProductCardStandard key={product.id} {...cardProps} product={product} />
                    ))}
                  </div>
                )}
              </section>
            );
          }

          if (section.type === 'promo-banner') {
            const countdown = section.countdownEndsAt ? (() => {
              const target = new Date(section.countdownEndsAt).getTime();
              const diff = target - Date.now();
              if (diff <= 0) return null;
              const hours = Math.floor(diff / (1000 * 60 * 60));
              const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
              const seconds = Math.floor((diff % (1000 * 60)) / 1000);
              return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
            })() : null;

            return (
              <section key={section.id} className="container-page mb-16" aria-label={section.title}>
                <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br from-white/90 via-slate-50/80 to-[var(--brand)]/10 p-8 md:p-12 shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.8),_transparent_60%)]" />
                  <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[var(--brand)]/20 blur-3xl" />
                  {section.imageUrl && (
                    <div className="relative z-10 mb-6 w-full md:mb-0 md:w-1/3 md:shrink-0 md:rounded-2xl md:overflow-hidden">
                      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl">
                        <Image src={section.imageUrl} alt={section.title || 'Promo banner'} fill className="object-cover" />
                      </div>
                    </div>
                  )}
                  <div className="relative z-10 flex-1 space-y-4 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand)]/20 bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--brand)] backdrop-blur">
                      <Zap className="w-3 h-3" />
                      Special Offer
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 font-display">{section.title}</h3>
                    <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">{section.subtitle}</p>
                    {countdown && (
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700">
                        <Clock3 className="h-3.5 w-3.5 text-[var(--brand)]" />
                        Ends in {countdown}
                      </div>
                    )}
                    {section.ctaLink && (
                      <a
                        href={section.ctaLink}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)] px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-lg transition-all hover:opacity-90"
                      >
                        {section.ctaText || 'Learn More'}
                        <Send className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </section>
            );
          }

          if (section.type === 'testimonials') {
            const isCarousel = section.testimonialStyle === 'carousel';
            return (
              <section key={section.id} className="container-page mb-16" aria-label={section.title}>
                <div className="text-center max-w-2xl mx-auto mb-10">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand)] font-mono">Reviews</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl font-display">{section.title || 'What Our Customers Say'}</h2>
                </div>
                {isCarousel ? (
                  <div className="relative">
                    <div className="flex gap-6 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-4">
                      {section.items?.map((item, i) => (
                        <div key={i} className="snap-start shrink-0 w-[320px] rounded-2xl border border-slate-200 bg-white p-6 space-y-4 flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-1 text-amber-400">
                              {Array.from({ length: 5 }).map((_, starIdx) => (
                                <Star key={starIdx} className={`h-3.5 w-3.5 ${starIdx < item.rating ? 'fill-current' : 'text-slate-600'}`} />
                              ))}
                            </div>
                            <p className="text-sm leading-relaxed text-slate-600 italic">&quot;{item.content}&quot;</p>
                          </div>
                          <div className="flex items-center gap-3 pt-2">
                            {item.avatarUrl && (
                              <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 ring-2 ring-slate-100">
                                <Image src={item.avatarUrl} alt={item.name} fill className="object-cover" />
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-bold text-slate-900">{item.name}</p>
                              {item.role && <p className="text-[10px] text-slate-500">{item.role}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-3">
                    {section.items?.map((item, i) => (
                      <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center gap-1 text-amber-400">
                            {Array.from({ length: 5 }).map((_, starIdx) => (
                              <Star key={starIdx} className={`h-3.5 w-3.5 ${starIdx < item.rating ? 'fill-current' : 'text-slate-600'}`} />
                            ))}
                          </div>
                          <p className="text-sm leading-relaxed text-slate-600 italic">&quot;{item.content}&quot;</p>
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                          {item.avatarUrl && (
                            <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 ring-2 ring-slate-100">
                              <Image src={item.avatarUrl} alt={item.name} fill className="object-cover" />
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-bold text-slate-900">{item.name}</p>
                            {item.role && <p className="text-[10px] text-slate-500">{item.role}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          }

          if (section.type === 'stats-bar') {
            return (
              <section key={section.id} className="container-page mb-16" aria-label={section.title}>
                <div className="rounded-2xl bg-gradient-to-r from-[var(--brand)] to-[var(--brand)]80 p-8 md:p-12 text-white">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    {[
                      { icon: Award, label: 'Happy Customers', value: '10K+' },
                      { icon: Package, label: 'Products Sold', value: '50K+' },
                      { icon: Star, label: '5-Star Reviews', value: '2K+' },
                      { icon: TrendingUp, label: 'Years Active', value: '5+' },
                    ].map((stat, idx) => (
                      <div key={idx} className="space-y-2">
                        <stat.icon className="w-8 h-8 mx-auto opacity-80" />
                        <p className="text-3xl font-black">{stat.value}</p>
                        <p className="text-xs uppercase tracking-wider opacity-80">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          if (section.type === 'feature-grid') {
            return (
              <section key={section.id} className="container-page mb-16" aria-label={section.title}>
                <div className="text-center max-w-2xl mx-auto mb-10">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand)] font-mono">Why Choose Us</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl font-display">{section.title || 'Our Features'}</h2>
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                  {[
                    { icon: Truck, title: 'Fast Delivery', desc: 'Quick order processing via WhatsApp' },
                    { icon: ShieldCheck, title: 'Secure Payments', desc: 'Safe and encrypted transactions' },
                    { icon: HeartHandshake, title: '24/7 Support', desc: 'Direct chat with our team' },
                    { icon: Sparkles, title: 'Quality Products', desc: 'Curated selection of premium items' },
                    { icon: MessageCircle, title: 'Easy Communication', desc: 'WhatsApp integration for seamless orders' },
                    { icon: Award, title: 'Trusted by Many', desc: 'Join thousands of satisfied customers' },
                  ].map((feature, idx) => (
                    <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3 hover:border-[var(--brand)] transition-colors">
                      <div className="w-12 h-12 rounded-xl bg-[var(--brand)]10 flex items-center justify-center">
                        <feature.icon className="w-6 h-6 text-[var(--brand)]" />
                      </div>
                      <h3 className="font-bold text-slate-900">{feature.title}</h3>
                      <p className="text-sm text-slate-600">{feature.desc}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          if (section.type === 'newsletter-cta') {
            return (
              <section key={section.id} className="container-page mb-16" aria-label={section.title}>
                <div className="rounded-2xl bg-slate-900 p-8 md:p-12 text-center text-white">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-[var(--brand)]" />
                  <h2 className="text-2xl font-black mb-2">{section.title || 'Stay Updated'}</h2>
                  <p className="text-slate-300 mb-6 max-w-md mx-auto">{section.subtitle || 'Subscribe to our newsletter for exclusive offers and updates.'}</p>
                  <div className="flex gap-2 max-w-sm mx-auto">
                    <input
                      type="email"
                      placeholder="Enter your email"
                      className="flex-1 px-4 py-3 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-slate-400 focus:outline-none focus:border-[var(--brand)]"
                    />
                    <button className="px-6 py-3 rounded-full bg-[var(--brand)] text-white font-bold hover:opacity-90 transition-colors">
                      Subscribe
                    </button>
                  </div>
                </div>
              </section>
            );
          }

          if (section.type === 'about-bento') {
            return (
              <section key={section.id} className="container-page mb-16" aria-label={section.title}>
                <div className="text-center max-w-2xl mx-auto mb-10">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand)] font-mono">About Us</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl font-display">{section.title || 'Our Story'}</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-4 md:grid-rows-2 auto-rows-[200px]">
                  <div className="md:col-span-2 md:row-span-2 rounded-2xl border border-slate-200 bg-white p-8 flex flex-col justify-center">
                    <Sparkles className="w-8 h-8 text-[var(--brand)] mb-4" />
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{store.name}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {store.aboutText && !store.aboutText.trim().startsWith('{') ? store.aboutText : store.description || `Welcome to ${store.name}. We strive to provide premium quality products and direct chat-based communication for quick, personalized support.`}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-center items-center text-center">
                    <Award className="w-8 h-8 text-[var(--brand)] mb-2" />
                    <p className="text-2xl font-black text-slate-900">5+</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Years</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-center items-center text-center">
                    <Star className="w-8 h-8 text-amber-400 mb-2" />
                    <p className="text-2xl font-black text-slate-900">4.9</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Rating</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-center items-center text-center">
                    <Package className="w-8 h-8 text-[var(--brand)] mb-2" />
                    <p className="text-2xl font-black text-slate-900">10K+</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Orders</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-center items-center text-center">
                    <HeartHandshake className="w-8 h-8 text-[var(--brand)] mb-2" />
                    <p className="text-2xl font-black text-slate-900">24/7</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Support</p>
                  </div>
                </div>
              </section>
            );
          }

          return null;
        })}
      </main>


      {/* ── About & Contact Bento Grid ── */}
      <section className="bg-slate-50 border-t border-slate-200 py-16" aria-label="About and contact">
        <div className="container-page grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 space-y-4">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 font-display">
              <Sparkles className="w-5 h-5 text-[var(--brand)]" />
              About Our Shop
            </h3>
            <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">
              {store.aboutText && !store.aboutText.trim().startsWith('{') ? store.aboutText : store.description || `Welcome to ${store.name}. We strive to provide premium quality products and direct chat-based communication for quick, support.`}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 space-y-4">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 font-display">
              <MapPin className="w-5 h-5 text-[var(--brand)]" />
              Find Us / Get in Touch
            </h3>
            <div className="space-y-3">
              {store.address && (
                <div className="flex items-start gap-2.5 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{store.address}</span>
                </div>
              )}
              {store.contactEmail && (
                <div className="flex items-start gap-2.5 text-sm text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <a href={`mailto:${store.contactEmail}`} className="hover:text-[var(--brand)] transition-colors">{store.contactEmail}</a>
                </div>
              )}
              {store.phoneWhatsapp && (
                <div className="flex items-start gap-2.5 text-sm text-slate-600">
                  <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <a href={handleWhatsappMessage()} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--brand)] transition-colors font-semibold">
                    WhatsApp Chat Support
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white text-slate-500">
        <div className="container-page py-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <p className="font-bold text-slate-900 text-base font-display">{store.name}</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your trusted merchant for direct order fulfilment. Fast and secure delivery via WhatsApp integration.
            </p>
            <div className="flex gap-3">
              {store.instagramUrl && (
                <a href={store.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                  className="p-2 rounded-full bg-slate-50 border border-slate-200 text-slate-400 hover:text-pink-400 hover:border-pink-400/30 transition-colors">
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {store.facebookUrl && (
                <a href={store.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                  className="p-2 rounded-full bg-slate-50 border border-slate-200 text-slate-400 hover:text-blue-400 hover:border-blue-400/30 transition-colors">
                  <Facebook className="w-4 h-4" />
                </a>
              )}
              {store.contactEmail && (
                <a href={`mailto:${store.contactEmail}`} aria-label="Email"
                  className="p-2 rounded-full bg-slate-50 border border-slate-200 text-slate-400 hover:text-[var(--brand)] hover:border-[var(--brand)]/30 transition-colors">
                  <Mail className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <p className="font-bold text-slate-900 text-sm uppercase tracking-wider font-mono">Categories</p>
            <ul className="text-xs space-y-2">
              <li>
                <button onClick={() => setSelectedCategoryId(null)} className="text-slate-500 hover:text-[var(--brand)] transition-colors hover:underline">
                  All Products
                </button>
              </li>
              {categories.map((cat) => (
                <li key={cat.id}>
                  <button onClick={() => setSelectedCategoryId(cat.id)} className="text-slate-500 hover:text-[var(--brand)] transition-colors hover:underline">
                    {cat.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-bold text-slate-900 text-sm uppercase tracking-wider font-mono">Support</p>
            <ul className="text-xs space-y-2">
              {store.phoneWhatsapp && (
                <li>
                  <a href={`https://wa.me/${store.phoneWhatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="text-slate-500 hover:text-[var(--brand)] transition-colors hover:underline">
                    Chat on WhatsApp
                  </a>
                </li>
              )}
              {store.contactEmail && (
                <li>
                  <a href={`mailto:${store.contactEmail}`} className="text-slate-500 hover:text-[var(--brand)] transition-colors hover:underline">
                    Email Support
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-bold text-slate-900 text-sm uppercase tracking-wider font-mono">MyWappStore</p>
            <p className="text-xs leading-relaxed text-slate-500">
              Configure your store and run marketing flows through the merchant panel.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {store.name}. All rights reserved.</p>
          <p className="mt-1">
            Powered by{' '}
            <Link href="/" className="font-semibold hover:underline text-[var(--brand)]">
              MyWappStore
            </Link>{' '}
            — Sell on WhatsApp
          </p>
        </div>
      </footer>

      {/* Cart Drawer */}
      <CartDrawer storeSlug={storeSlug} />

      {/* ── Sticky Cart Bar (mobile) ── */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-safe-area-inset-bottom sm:hidden bg-white/95 border-t border-slate-200 shadow-xl">
          <div className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="w-5 h-5 text-[var(--brand)]" />
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white">
                  {cartCount}
                </span>
              </div>
              <span className="text-sm font-bold text-slate-900">
                {cartCount} item{cartCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-[var(--brand)]">{formatCurrency(cartTotal)}</span>
              <button
                onClick={openCart}
                className="rounded-full px-5 py-2.5 text-sm font-bold shadow-lg transition-all hover:opacity-90 active:scale-95 bg-[var(--brand)] text-white"
              >
                View Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scroll to top ── */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-20 sm:bottom-6 right-6 z-40 p-3 rounded-full transition-all hover:scale-110 active:scale-95 bg-white border border-slate-200 text-slate-600 shadow-lg hover:border-[var(--brand)]"
          aria-label="Scroll to top"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}

      {/* ── Floating WhatsApp ── */}
      {store.phoneWhatsapp && (
        <a
          href={handleWhatsappMessage()}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-40 p-4 rounded-full text-white shadow-xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center gap-2 group bg-emerald-600 hover:bg-emerald-500"
          style={{ boxShadow: '0 8px 30px rgb(16 185 129 / 0.35)' }}
          aria-label="Chat on WhatsApp"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-out text-sm font-semibold whitespace-nowrap">
            Chat with us
          </span>
        </a>
      )}
    </div>
  );
}
