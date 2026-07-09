import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShoppingBag, MessageCircle, Star } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { CartDrawer } from '@/components/storefront/CartDrawer';

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
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header / Hero */}
      <header
        className="relative"
        style={{ '--store-brand': store.primaryColor } as React.CSSProperties}
      >
        {/* Banner */}
        <div className="h-40 sm:h-56 bg-gradient-to-br from-[var(--brand)] to-[var(--brand-hover)] overflow-hidden relative">
          {store.bannerUrl ? (
            <Image src={store.bannerUrl} alt={`${store.name} banner`} fill className="object-cover opacity-60" />
          ) : (
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}
            />
          )}
        </div>

        {/* Store info bar */}
        <div className="container-page">
          <div className="flex items-end gap-4 -mt-8 pb-5">
            {/* Logo */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border-4 border-white shadow-lg overflow-hidden shrink-0 flex items-center justify-center">
              {store.logoUrl ? (
                <Image src={store.logoUrl} alt={store.name} width={80} height={80} className="object-cover" />
              ) : (
                <ShoppingBag className="w-8 h-8 text-[var(--brand)]" />
              )}
            </div>

            <div className="flex-1 min-w-0 pt-10">
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] truncate">{store.name}</h1>
              {store.description && (
                <p className="text-sm text-[var(--text-secondary)] mt-0.5 line-clamp-2">{store.description}</p>
              )}
            </div>

            {store.phoneWhatsapp && (
              <a
                href={`https://wa.me/${store.phoneWhatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp shrink-0 hidden sm:flex"
              >
                <MessageCircle className="w-4 h-4" />
                Chat with us
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="border-b border-[var(--border)] bg-[var(--surface-1)] sticky top-0 z-10">
          <div className="container-page py-2 flex gap-2 overflow-x-auto scrollbar-none">
            <Link
              href={`/${storeSlug}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                !categoryFilter
                  ? 'bg-[var(--brand)] text-white'
                  : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]'
              }`}
            >
              All
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/${storeSlug}?category=${cat.id}`}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                  categoryFilter === cat.id
                    ? 'bg-[var(--brand)] text-white'
                    : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]'
                }`}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Products grid */}
      <div className="container-page py-8">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <ShoppingBag className="w-12 h-12 text-[var(--text-muted)] mb-4" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">No products yet</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.trackInventory && !product.allowBackorder && product.stockQuantity === 0;
              const discount =
                product.compareAtPrice
                  ? Math.round((1 - parseFloat(product.price) / parseFloat(product.compareAtPrice)) * 100)
                  : null;

              return (
                <Link
                  key={product.id}
                  href={`/${storeSlug}/products/${product.slug}`}
                  className={`group flex flex-col rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface-1)] hover:shadow-lg hover:border-[var(--brand)] transition-all duration-200 ${isOutOfStock ? 'opacity-60' : ''}`}
                >
                  {/* Image */}
                  <div className="relative aspect-square bg-[var(--surface-3)] overflow-hidden">
                    {product.images?.[0] ? (
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-4xl">📦</div>
                    )}

                    {discount && discount > 0 && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        -{discount}%
                      </div>
                    )}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <span className="bg-black/70 text-white text-xs px-3 py-1 rounded-full font-medium">Out of Stock</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 flex flex-col gap-1 flex-1">
                    {product.category && (
                      <p className="text-[10px] font-medium text-[var(--brand)] uppercase tracking-widest">
                        {product.category.name}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2 flex-1">
                      {product.name}
                    </p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-base font-bold text-[var(--text-primary)]">
                        {formatCurrency(product.price)}
                      </span>
                      {product.compareAtPrice && (
                        <span className="text-xs text-[var(--text-muted)] line-through">
                          {formatCurrency(product.compareAtPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8 mt-8">
        <div className="container-page text-center">
          <p className="text-xs text-[var(--text-muted)]">
            Powered by{' '}
            <Link href="/" className="text-[var(--brand)] hover:underline font-medium">
              MyWappStore
            </Link>
            {' '}— Sell on WhatsApp
          </p>
        </div>
      </footer>

      {/* Cart drawer (floats over everything) */}
      <CartDrawer storeSlug={storeSlug} />
    </div>
  );
}
