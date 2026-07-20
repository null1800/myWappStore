import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Truck, Star, MessageCircle, RotateCcw, ShoppingBag, Sparkles, Mail, MapPin, X, Zap } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AddToCartButton } from '@/components/storefront/AddToCartButton';
import { CartDrawer } from '@/components/storefront/CartDrawer';
import { StorefrontCartButton } from '@/components/storefront/StorefrontCartButton';
import { parseStorefrontConfig } from '@/lib/storefront-config';
import { ProductColorSelector } from '@/components/storefront/ProductColorSelector';

interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: string;
  compareAtPrice: string | null;
  images?: string[];
  stockQuantity: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  category?: { id: string; name: string } | null;
  tags?: string[];
}

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

export const dynamic = 'force-dynamic';

async function getStoreAndProduct(storeSlug: string, productSlug: string) {
  try {
    const [storeRes, productsRes] = await Promise.all([
      publicApi.get(`/stores/${storeSlug}`),
      publicApi.get(`/stores/${storeSlug}/products`, { params: { limit: 100 } }),
    ]);
    const store = storeRes.data.data as StoreInfo;
    const products = productsRes.data.data as ProductDetail[];
    const product = products.find((p) => p.slug === productSlug);
    return { store, product: product ?? null };
  } catch {
    return null;
  }
}

const PREDEFINED_DISPLAY_TYPES: Record<string, { label: string; class: string }> = {
  'featured': { label: 'Featured', class: 'bg-amber-400/90 text-amber-950 border-amber-500/20' },
  'best seller': { label: 'Best Seller', class: 'bg-orange-500/90 text-white border-orange-600/20' },
  'new arrival': { label: 'New Arrival', class: 'bg-blue-500/90 text-white border-blue-600/20' },
  'latest': { label: 'Latest', class: 'bg-emerald-500/90 text-white border-emerald-600/20' },
  'most popular': { label: 'Most Popular', class: 'bg-purple-500/90 text-white border-purple-600/20' },
  'recommended': { label: 'Recommended', class: 'bg-teal-500/90 text-white border-teal-600/20' },
  'on sale': { label: 'On Sale', class: 'bg-red-500/90 text-white border-red-600/20' },
  'limited edition': { label: 'Limited Edition', class: 'bg-indigo-600/90 text-white font-black border-indigo-700/20' },
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ storeSlug: string; slug: string }>;
}) {
  const { storeSlug, slug } = await params;
  const data = await getStoreAndProduct(storeSlug, slug);

  if (!data || !data.product) notFound();

  const { store, product } = data;

  if (!store.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center px-4 max-w-sm">
          <p className="text-4xl mb-4">🔒</p>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{store.name} is temporarily closed</h1>
          <p className="text-[var(--text-secondary)] mt-2 text-sm">
            This store is not currently accepting orders. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  const isOutOfStock =
    product.trackInventory && !product.allowBackorder && product.stockQuantity === 0;

  // Parse custom dynamic store builder config
  const builderConfig = parseStorefrontConfig(store);

  const brandColor = store.primaryColor === '#0F6E56' ? '#b0db60' : store.primaryColor;

  // Find any predefined classification tag to show as a badge
  const displayBadge = product.tags?.map(t => t.toLowerCase()).find(t => t in PREDEFINED_DISPLAY_TYPES);

  const handleWhatsappMessage = () => {
    if (!store.phoneWhatsapp) return '';
    const text = encodeURIComponent(
      `Hello ${store.name}! I am looking at the product "${product.name}" and have a question.`
    );
    return `https://wa.me/${store.phoneWhatsapp.replace(/[^0-9]/g, '')}?text=${text}`;
  };

  return (
    <div
      className="artech-storefront min-h-screen text-slate-900 bg-white font-sans selection:bg-[var(--brand)] selection:text-white"
      style={{ '--brand': brandColor } as React.CSSProperties}
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
      <header className="sticky top-0 z-20 border-b border-slate-200/50 bg-white/70 artech-glass">
        <nav className="container-page relative z-10 flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/${storeSlug}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-[var(--brand)] bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-full transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </Link>
            
            <Link href={`/${storeSlug}`} className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                {builderConfig.navigation?.logoUrl ? (
                  <Image src={builderConfig.navigation.logoUrl} alt={store.name} width={32} height={32} className="h-full w-full object-cover" />
                ) : store.logoUrl ? (
                  <Image src={store.logoUrl} alt={store.name} width={32} height={32} className="h-full w-full object-cover" />
                ) : (
                  <ShoppingBag className="h-4 w-4 text-[var(--brand)]" />
                )}
              </div>
              <span className="truncate text-sm font-bold text-slate-900 hidden sm:inline font-display">{store.name}</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {builderConfig.navigation?.whatsappEnabled && store.phoneWhatsapp && (
              <a
                href={handleWhatsappMessage()}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-slate-200 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all inline-flex items-center font-mono"
              >
                <MessageCircle className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                Ask a question
              </a>
            )}
            <StorefrontCartButton />
          </div>
        </nav>
      </header>

      <main className="container-page py-8 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50 shadow-2xl">
              {product.images?.[0] ? (
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-7xl">📦</div>
              )}
              {isOutOfStock && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="rounded-full bg-black/75 px-5 py-2 text-sm font-bold text-white border border-slate-300">Out of stock</span>
                </div>
              )}
            </div>

            {(product.images?.length ?? 0) > 1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                {(product.images ?? []).slice(0, 6).map((img: string, i: number) => (
                  <div key={i} className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                    <Image src={img} alt={`${product.name} ${i + 1}`} width={80} height={80} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
              
              <div className="flex flex-wrap gap-2 mb-4">
                {product.category && (
                  <Link href={`/${storeSlug}?category=${product.category.id}`} className="inline-flex rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--brand)] hover:underline font-mono">
                    {product.category.name}
                  </Link>
                )}
                
                {displayBadge && (
                  <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] border ${PREDEFINED_DISPLAY_TYPES[displayBadge].class}`}>
                    {PREDEFINED_DISPLAY_TYPES[displayBadge].label}
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl font-display">
                {product.name}
              </h1>

              <div className="mt-4 flex items-center gap-2 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                <span className="ml-2 text-sm font-semibold text-slate-500">Trusted customer favorite</span>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-slate-200 py-5">
                <span className="text-4xl font-black text-[var(--brand)]">{formatCurrency(product.price)}</span>
                {product.compareAtPrice && <span className="text-xl text-slate-400 line-through">{formatCurrency(product.compareAtPrice)}</span>}
                {product.compareAtPrice && <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-xs text-red-500 font-extrabold">-{Math.round((1 - parseFloat(product.price) / parseFloat(product.compareAtPrice)) * 100)}% off</span>}
              </div>

              {product.trackInventory && (
                <p className={`mt-5 inline-flex rounded-full px-3 py-1 text-sm font-bold border ${
                  product.stockQuantity === 0 ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                  product.stockQuantity <= 5 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                }`}>
                  {product.stockQuantity === 0 ? 'Out of stock' : product.stockQuantity <= 5 ? `Only ${product.stockQuantity} left in stock` : 'In stock and ready to order'}
                </p>
              )}

              {product.description && <p className="mt-6 text-base leading-8 text-slate-600 whitespace-pre-line">{product.description}</p>}

              <div className="mt-8">
                <AddToCartButton
                  product={{
                    productId: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.images?.[0] ?? null,
                    maxStock: product.stockQuantity,
                    allowBackorder: product.allowBackorder,
                  }}
                  storeSlug={storeSlug}
                  isOutOfStock={isOutOfStock}
                />
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  [ShieldCheck, 'Secure order'],
                  [Truck, 'Delivery details'],
                  [MessageCircle, 'WhatsApp support'],
                ].map(([Icon, label]: any) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                    <Icon className="mx-auto h-5 w-5 text-[var(--brand)]" />
                    <p className="mt-2 text-xs font-bold text-slate-600">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <RotateCcw className="mt-0.5 h-5 w-5 text-[var(--brand)]" />
                <div>
                  <p className="text-sm font-bold text-slate-900">Order with clarity</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Review your cart, contact information, delivery address, and payment preference before sending the order.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Detailed About and Location Section */}
      <section className="bg-slate-50 border-t border-slate-200 py-16" aria-label="About and contact info">
        <div className="container-page grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 space-y-4">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 font-display">
              <Sparkles className="w-5 h-5 text-[var(--brand)]" />
              About Our Shop
            </h3>
            <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">
              {store.aboutText && !store.aboutText.trim().startsWith('{') ? store.aboutText : store.description || `Welcome to ${store.name}. We strive to provide premium quality products and direct chat-based communication for quick, personalized support.`}
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
                  <MapPin className="w-4.5 h-4.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{store.address}</span>
                </div>
              )}
              {store.contactEmail && (
                <div className="flex items-start gap-2.5 text-sm text-slate-600">
                  <Mail className="w-4.5 h-4.5 text-slate-400 shrink-0 mt-0.5" />
                  <a href={`mailto:${store.contactEmail}`} className="hover:text-[var(--brand)] transition-colors">{store.contactEmail}</a>
                </div>
              )}
              {store.phoneWhatsapp && (
                <div className="flex items-start gap-2.5 text-sm text-slate-600">
                  <MessageCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                  <a href={`https://wa.me/${store.phoneWhatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--brand)] transition-colors font-semibold">
                    WhatsApp Chat Support
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white text-slate-500">
        <div className="container-page py-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <p className="font-bold text-slate-900 text-base font-display">{store.name}</p>
            <p className="text-xs text-slate-500">
              Your trusted merchant for direct order fulfilment. Fast and secure delivery via WhatsApp integration.
            </p>
          </div>
          <div className="space-y-3 text-xs">
            <p className="font-bold text-slate-900 text-sm uppercase tracking-wider font-mono">Quick Links</p>
            <Link href={`/${storeSlug}`} className="block text-slate-500 hover:text-[var(--brand)] hover:underline mt-2">
              Back to Catalog
            </Link>
          </div>
        </div>
      </footer>

      <CartDrawer storeSlug={storeSlug} />
    </div>
  );
}
