import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShoppingBag, MessageCircle, Star, ShieldCheck, Truck, Search, Sparkles, HeartHandshake } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { CartDrawer } from '@/components/storefront/CartDrawer';
import { StorefrontCartButton } from '@/components/storefront/StorefrontCartButton';

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
}

// Revalidate storefront pages every 60 seconds (ISR).
// Public store data (name, branding, products) changes infrequently — no
// reason to hit the backend API on every storefront visit. A 60-second
// cache window means a product update is visible within a minute, while
// the vast majority of visits are served from the cache.
export const revalidate = 60;

async function getStoreData(slug: string) {
  try {
    const [storeRes, productsRes] = await Promise.all([
      publicApi.get(`/stores/${slug}`),
      publicApi.get(`/stores/${slug}/products`, { params: { limit: 100 } }),
    ]);
    return {
      store: storeRes.data.data as StoreInfo,
      products: productsRes.data.data as Product[],
    };
  } catch {
    return null;
  }
}

export default async function StorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { storeSlug } = await params;
  const { category: categoryFilter } = await searchParams;

  const result = await getStoreData(storeSlug);
  if (!result) notFound();

  const { store, products } = result;

  // Inactive stores get a polite "closed" page — not a 404 — so the
  // merchant can see it and customers get a clear message
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

  // Get unique categories from active products
  const categories = Array.from(
    new Map(
      products
        .filter((p) => p.category)
        .map((p) => [p.category!.id, p.category!])
    ).values()
  );

  const filteredProducts = categoryFilter
    ? products.filter((p) => p.category?.id === categoryFilter)
    : products;

  return (
    <div className="min-h-screen bg-storefront text-[var(--text-primary)]">
      {/* Premium storefront header / hero */}
      <header
        className="relative overflow-hidden border-b border-white/70 bg-[radial-gradient(circle_at_top_left,var(--brand-light),transparent_32rem),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]"
        style={{ '--store-brand': store.primaryColor } as React.CSSProperties}
      >
        <div className="absolute inset-0 opacity-40 storefront-grid" aria-hidden="true" />
        <nav className="container-page relative z-10 flex items-center justify-between py-4">
          <Link href={`/${storeSlug}`} className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/80 bg-white shadow-sm">
              {store.logoUrl ? (
                <Image src={store.logoUrl} alt={store.name} width={44} height={44} className="h-full w-full object-cover" />
              ) : (
                <ShoppingBag className="h-5 w-5 text-[var(--brand)]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--text-primary)]">{store.name}</p>
              <p className="text-xs text-[var(--text-secondary)]">Secure WhatsApp storefront</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {store.phoneWhatsapp && (
              <a
                href={`https://wa.me/${store.phoneWhatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden rounded-full border border-[var(--border)] bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm backdrop-blur transition hover:border-[var(--brand)] hover:text-[var(--brand)] sm:inline-flex"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Ask a question
              </a>
            )}
            <StorefrontCartButton />
          </div>
        </nav>

        <div className="container-page relative z-10 grid gap-8 pb-10 pt-4 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:pb-14 lg:pt-10">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-[var(--brand)]" />
              Curated products • Fast ordering • Trusted seller
            </div>
            <h1 className="text-4xl font-black tracking-tight text-[var(--text-primary)] sm:text-5xl lg:text-6xl">
              Shop {store.name} with confidence.
            </h1>
            {store.description && (
              <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
                {store.description}
              </p>
            )}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href="#products" className="btn-primary rounded-full px-6 py-3 text-base shadow-lg shadow-emerald-900/10">
                Browse collection
                <ShoppingBag className="h-5 w-5" />
              </a>
              {store.phoneWhatsapp && (
                <a href={`https://wa.me/${store.phoneWhatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="btn-whatsapp rounded-full px-6 py-3 text-base">
                  <MessageCircle className="h-5 w-5" />
                  Chat on WhatsApp
                </a>
              )}
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3 sm:max-w-xl">
              {[
                ['4.9/5', 'Customer rating'],
                [String(products.length), 'Available items'],
                ['Secure', 'WhatsApp checkout'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur">
                  <p className="text-lg font-black text-[var(--text-primary)]">{value}</p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[20rem] overflow-hidden rounded-[2rem] border border-white/80 bg-[var(--surface-1)] shadow-2xl shadow-slate-900/10">
            {store.bannerUrl ? (
              <Image src={store.bannerUrl} alt={`${store.name} banner`} fill className="object-cover" priority />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand)] via-emerald-500 to-slate-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/15 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 rounded-3xl border border-white/20 bg-white/90 p-5 shadow-xl backdrop-blur">
              <div className="flex items-center gap-1 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">Professional shopping experience with clear pricing, quick support, and a streamlined order flow.</p>
            </div>
          </div>
        </div>
      </header>

      <section className="border-b border-[var(--border)] bg-white">
        <div className="container-page grid gap-3 py-4 sm:grid-cols-3">
          {[
            [ShieldCheck, 'Buyer confidence', 'Clear order details before confirmation'],
            [Truck, 'Delivery ready', 'Address and contact captured at checkout'],
            [HeartHandshake, 'Responsive support', 'Message the seller directly on WhatsApp'],
          ].map(([Icon, title, text]) => (
            <div key={String(title)} className="flex items-center gap-3 rounded-2xl bg-[var(--surface-2)] p-4">
              <div className="rounded-xl bg-white p-2 text-[var(--brand)] shadow-sm"><Icon className="h-5 w-5" /></div>
              <div>
                <p className="text-sm font-bold">{String(title)}</p>
                <p className="text-xs text-[var(--text-secondary)]">{String(text)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {categories.length > 0 && (
        <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/90 backdrop-blur-xl">
          <div className="container-page flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              <Link href={`/${storeSlug}`} className={`storefront-chip ${!categoryFilter ? 'storefront-chip-active' : ''}`}>All products</Link>
              {categories.map((cat) => (
                <Link key={cat.id} href={`/${storeSlug}?category=${cat.id}`} className={`storefront-chip ${categoryFilter === cat.id ? 'storefront-chip-active' : ''}`}>{cat.name}</Link>
              ))}
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-4 py-2 text-sm text-[var(--text-muted)] shadow-sm md:flex">
              <Search className="h-4 w-4" />
              Browse by category
            </div>
          </div>
        </div>
      )}

      <main id="products" className="container-page py-10 sm:py-14">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--brand)]">Featured collection</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Products customers love</h2>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{filteredProducts.length} item{filteredProducts.length === 1 ? '' : 's'} available</p>
        </div>
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-[var(--border)] bg-white p-12 text-center shadow-sm">
            <ShoppingBag className="mb-4 h-12 w-12 text-[var(--text-muted)]" />
            <h2 className="text-lg font-bold text-[var(--text-primary)]">No products yet</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Check back soon for new arrivals.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:gap-6">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.trackInventory && !product.allowBackorder && product.stockQuantity === 0;
              const discount = product.compareAtPrice ? Math.round((1 - parseFloat(product.price) / parseFloat(product.compareAtPrice)) * 100) : null;
              return (
                <Link key={product.id} href={`/${storeSlug}/products/${product.slug}`} className={`group flex min-h-full flex-col overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[var(--brand)] hover:shadow-2xl hover:shadow-slate-900/10 ${isOutOfStock ? 'opacity-60' : ''}`}>
                  <div className="relative aspect-[4/5] overflow-hidden bg-[var(--surface-3)]">
                    {product.images?.[0] ? (
                      <Image src={product.images[0]} alt={product.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-5xl">📦</div>
                    )}
                    <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                      {discount && discount > 0 ? <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-black text-white shadow-lg">-{discount}%</span> : <span />}
                      <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm backdrop-blur">View</span>
                    </div>
                    {isOutOfStock && <div className="absolute inset-0 flex items-center justify-center bg-black/35"><span className="rounded-full bg-black/75 px-3 py-1 text-xs font-bold text-white">Out of stock</span></div>}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    {product.category && <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--brand)]">{product.category.name}</p>}
                    <p className="line-clamp-2 flex-1 text-sm font-bold leading-5 text-[var(--text-primary)] sm:text-base">{product.name}</p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-2">
                      <span className="text-lg font-black text-[var(--text-primary)]">{formatCurrency(product.price)}</span>
                      {product.compareAtPrice && <span className="text-sm text-[var(--text-muted)] line-through">{formatCurrency(product.compareAtPrice)}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-[var(--border)] bg-white py-10">
        <div className="container-page flex flex-col gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div>
            <p className="font-bold text-[var(--text-primary)]">{store.name}</p>
            <p className="text-xs text-[var(--text-muted)]">Secure storefront powered by MyWappStore</p>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Powered by <Link href="/" className="font-bold text-[var(--brand)] hover:underline">MyWappStore</Link> — Sell on WhatsApp</p>
        </div>
      </footer>

      {/* Cart drawer (floats over everything) */}
      <CartDrawer storeSlug={storeSlug} />
    </div>
  );
}
