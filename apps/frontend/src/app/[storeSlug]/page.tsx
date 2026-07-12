import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShoppingBag, MessageCircle, Star, ShieldCheck, Truck, Sparkles, HeartHandshake, SlidersHorizontal } from 'lucide-react';
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
          <h1 className="text-xl font-bold text-white">{store.name} is temporarily closed</h1>
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
    <div className="storefront-tech min-h-screen text-white">
      {/* Premium storefront header / hero */}
      <header
        className="relative overflow-hidden border-b border-lime-300/20 bg-[#111112]"
        style={{ '--store-brand': store.primaryColor } as React.CSSProperties}
      >
        <div className="absolute inset-0 opacity-20 storefront-grid" aria-hidden="true" />
        <nav className="container-page relative z-10 flex items-center justify-between py-5">
          <Link href={`/${storeSlug}`} className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-lime-300/25 bg-[#1f1f21] shadow-sm">
              {store.logoUrl ? (
                <Image src={store.logoUrl} alt={store.name} width={44} height={44} className="h-full w-full object-cover" />
              ) : (
                <ShoppingBag className="h-5 w-5 text-[var(--brand)]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{store.name}</p>
              <p className="text-xs text-lime-300">Shop</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {store.phoneWhatsapp && (
              <a
                href={`https://wa.me/${store.phoneWhatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden rounded-full border border-lime-300/30 bg-[#1f1f21] px-4 py-2 font-mono text-sm font-semibold text-lime-300 shadow-sm transition hover:bg-lime-300 hover:text-black sm:inline-flex"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Ask a question
              </a>
            )}
            <StorefrontCartButton />
          </div>
        </nav>

        <div className="container-page relative z-10 grid gap-8 pb-10 pt-4 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:pb-16 lg:pt-12">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest text-lime-300">
              <Sparkles className="h-3.5 w-3.5 text-[var(--brand)]" />
              Next-gen storefront • Fast ordering • Trusted seller
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              Precision shopping.
              <span className="block text-lime-300">Engineered to convert.</span>
            </h1>
            {store.description && (
              <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
                {store.description}
              </p>
            )}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href="#products" className="rounded-md bg-lime-300 px-6 py-3 text-sm font-black uppercase tracking-widest text-black shadow-[0_0_30px_rgba(190,242,100,0.18)] transition hover:bg-lime-200">
                Shop products
                <ShoppingBag className="h-5 w-5" />
              </a>
              {store.phoneWhatsapp && (
                <a href={`https://wa.me/${store.phoneWhatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="rounded-md border border-lime-300/50 px-6 py-3 text-sm font-black uppercase tracking-widest text-lime-300 transition hover:bg-lime-300 hover:text-black">
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
                <div key={label} className="rounded-xl border border-lime-300/15 bg-[#1f1f21] p-5 shadow-sm">
                  <p className="font-mono text-lg font-black text-lime-300">{value}</p>
                  <p className="mt-1 font-mono text-xs font-medium uppercase tracking-widest text-zinc-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[20rem] overflow-hidden rounded-2xl border border-lime-300/20 bg-[#1f1f21] shadow-2xl shadow-black/40">
            {store.bannerUrl ? (
              <Image src={store.bannerUrl} alt={`${store.name} banner`} fill className="object-cover" priority />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand)] via-emerald-500 to-slate-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/15 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 rounded-3xl border border-white/20 bg-black/80 p-5 shadow-xl backdrop-blur">
              <div className="flex items-center gap-1 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="mt-2 text-sm font-semibold text-zinc-100">Professional shopping experience with clear pricing, quick support, and a streamlined order flow.</p>
            </div>
          </div>
        </div>
      </header>

      <section className="border-b border-lime-300/15 bg-[#202021]">
        <div className="container-page grid gap-3 py-4 sm:grid-cols-3">
          {[
            [ShieldCheck, 'Buyer confidence', 'Clear order details before confirmation'],
            [Truck, 'Delivery ready', 'Address and contact captured at checkout'],
            [HeartHandshake, 'Responsive support', 'Message the seller directly on WhatsApp'],
          ].map(([Icon, title, text]) => (
            <div key={String(title)} className="flex items-center gap-3 rounded-xl border border-lime-300/10 bg-[#18181a] p-5">
              <div className="rounded-lg bg-lime-300/10 p-2 text-lime-300 shadow-sm"><Icon className="h-5 w-5" /></div>
              <div>
                <p className="text-sm font-bold text-white">{String(title)}</p>
                <p className="text-xs text-zinc-500">{String(text)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {categories.length > 0 && (
        <div className="sticky top-0 z-20 border-b border-lime-300/15 bg-[#202021]/90 backdrop-blur-xl">
          <div className="container-page flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              <Link href={`/${storeSlug}`} className={`storefront-chip ${!categoryFilter ? 'storefront-chip-active' : ''}`}>All products</Link>
              {categories.map((cat) => (
                <Link key={cat.id} href={`/${storeSlug}?category=${cat.id}`} className={`storefront-chip ${categoryFilter === cat.id ? 'storefront-chip-active' : ''}`}>{cat.name}</Link>
              ))}
            </div>
            <div className="hidden items-center gap-2 rounded-md border border-lime-300/20 bg-[#1f1f21] px-4 py-2 font-mono text-sm text-zinc-500 shadow-sm md:flex">
              <SlidersHorizontal className="h-4 w-4 text-lime-300" />
              Filter components
            </div>
          </div>
        </div>
      )}

      <main id="products" className="container-page py-12 sm:py-16">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-sm font-bold uppercase tracking-[0.25em] text-lime-300">Featured collection</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">Products customers love</h2>
          </div>
          <p className="font-mono text-sm text-zinc-500">{filteredProducts.length} item{filteredProducts.length === 1 ? '' : 's'} available</p>
        </div>
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-lime-300/20 bg-[#1f1f21] p-12 text-center shadow-sm">
            <ShoppingBag className="mb-4 h-12 w-12 text-[var(--text-muted)]" />
            <h2 className="text-lg font-bold text-white">No products yet</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Check back soon for new arrivals.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-8">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.trackInventory && !product.allowBackorder && product.stockQuantity === 0;
              const discount = product.compareAtPrice ? Math.round((1 - parseFloat(product.price) / parseFloat(product.compareAtPrice)) * 100) : null;
              return (
                <Link key={product.id} href={`/${storeSlug}/products/${product.slug}`} className={`group flex min-h-full flex-col overflow-hidden rounded-xl border border-lime-300/20 bg-[#1f1f21] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-lime-300/70 hover:shadow-2xl hover:shadow-lime-950/20 ${isOutOfStock ? 'opacity-60' : ''}`}>
                  <div className="relative aspect-[4/3] overflow-hidden bg-[var(--surface-3)]">
                    {product.images?.[0] ? (
                      <Image src={product.images[0]} alt={product.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-5xl">📦</div>
                    )}
                    <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                      {discount && discount > 0 ? <span className="rounded-md bg-blue-500 px-2.5 py-1 font-mono text-xs font-black uppercase text-white shadow-lg">-{discount}%</span> : <span />}
                      <span className="rounded-md bg-lime-300 px-2.5 py-1 font-mono text-[11px] font-black uppercase text-black shadow-sm backdrop-blur">View</span>
                    </div>
                    {isOutOfStock && <div className="absolute inset-0 flex items-center justify-center bg-black/35"><span className="rounded-full bg-black/75 px-3 py-1 text-xs font-bold text-white">Out of stock</span></div>}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    {product.category && <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">{product.category.name}</p>}
                    <p className="line-clamp-2 flex-1 text-xl font-black leading-6 text-white sm:text-2xl">{product.name}</p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-lg font-black text-lime-300">{formatCurrency(product.price)}</span>
                      {product.compareAtPrice && <span className="text-sm text-[var(--text-muted)] line-through">{formatCurrency(product.compareAtPrice)}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-lime-300/20 bg-black py-12">
        <div className="container-page flex flex-col gap-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div>
            <p className="font-bold text-white">{store.name}</p>
            <p className="font-mono text-xs text-zinc-600">Secure storefront powered by MyWappStore</p>
          </div>
          <p className="font-mono text-xs text-zinc-600">Powered by <Link href="/" className="font-bold text-[var(--brand)] hover:underline">MyWappStore</Link> — Sell on WhatsApp</p>
        </div>
      </footer>

      {/* Cart drawer (floats over everything) */}
      <CartDrawer storeSlug={storeSlug} />
    </div>
  );
}
