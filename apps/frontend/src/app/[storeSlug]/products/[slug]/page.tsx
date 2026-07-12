import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Truck, Star, MessageCircle, RotateCcw } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AddToCartButton } from '@/components/storefront/AddToCartButton';
import { CartDrawer } from '@/components/storefront/CartDrawer';
import { StorefrontCartButton } from '@/components/storefront/StorefrontCartButton';

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

async function getProduct(storeSlug: string, productSlug: string) {
  try {
    // Use the stores endpoint for public product listing then find by slug
    const { data } = await publicApi.get(`/stores/${storeSlug}/products`, {
      params: { limit: 100 },
    });
    const products = data.data as ProductDetail[];
    const product = products.find((p) => p.slug === productSlug);
    return product ?? null;
  } catch {
    return null;
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ storeSlug: string; slug: string }>;
}) {
  const { storeSlug, slug } = await params;
  const product = await getProduct(storeSlug, slug);

  if (!product) notFound();

  const isOutOfStock =
    product.trackInventory && !product.allowBackorder && product.stockQuantity === 0;

  return (
    <div className="storefront-tech min-h-screen text-white">
      <div className="sticky top-0 z-20 border-b border-lime-300/15 bg-[#141416]/90 backdrop-blur-xl">
        <div className="container-page flex items-center justify-between py-3">
          <Link
            href={`/${storeSlug}`}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-sm font-semibold text-zinc-400 transition hover:bg-lime-300/10 hover:text-lime-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to store
          </Link>
          <StorefrontCartButton />
        </div>
      </div>

      <main className="container-page py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-xl border border-lime-300/20 bg-[#1f1f21] shadow-2xl shadow-black/50">
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
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-3)] text-7xl">📦</div>
              )}
              {isOutOfStock && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="rounded-full bg-black/75 px-5 py-2 text-sm font-bold text-white">Out of stock</span>
                </div>
              )}
            </div>

            {(product.images?.length ?? 0) > 1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                {(product.images ?? []).slice(0, 6).map((img: string, i: number) => (
                  <div key={i} className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-lime-300/25 bg-[#1f1f21] shadow-sm">
                    <Image src={img} alt={`${product.name} ${i + 1}`} width={80} height={80} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-lime-300/20 bg-[#1f1f21] p-6 shadow-xl shadow-black/30 sm:p-8">
              {product.category && (
                <Link href={`/${storeSlug}?category=${product.category.id}`} className="mb-4 inline-flex rounded-md bg-lime-300/10 px-3 py-1 font-mono text-xs font-black uppercase tracking-[0.22em] text-lime-300 hover:underline">
                  {product.category.name}
                </Link>
              )}

              <h1 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
                {product.name}
              </h1>

              <div className="mt-4 flex items-center gap-2 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                <span className="ml-2 text-sm font-semibold text-zinc-500">Trusted customer favorite</span>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-lime-300/15 py-5">
                <span className="font-mono text-4xl font-black text-lime-300">{formatCurrency(product.price)}</span>
                {product.compareAtPrice && <span className="font-mono text-xl text-zinc-600 line-through">{formatCurrency(product.compareAtPrice)}</span>}
                {product.compareAtPrice && <span className="badge badge-red text-xs">{Math.round((1 - parseFloat(product.price) / parseFloat(product.compareAtPrice)) * 100)}% off</span>}
              </div>

              {product.trackInventory && (
                <p className={`mt-5 inline-flex rounded-full px-3 py-1 text-sm font-bold ${
                  product.stockQuantity === 0 ? 'bg-red-50 text-red-600' :
                  product.stockQuantity <= 5 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {product.stockQuantity === 0 ? 'Out of stock' : product.stockQuantity <= 5 ? `Only ${product.stockQuantity} left in stock` : 'In stock and ready to order'}
                </p>
              )}

              {product.description && <p className="mt-6 text-base leading-8 text-zinc-400">{product.description}</p>}

              {(product.tags?.length ?? 0) > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {(product.tags ?? []).map((tag: string) => <span key={tag} className="badge badge-gray text-xs">{tag}</span>)}
                </div>
              )}

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
                ].map(([Icon, label]) => (
                  <div key={String(label)} className="rounded-xl border border-lime-300/10 bg-[#18181a] p-3 text-center">
                    <Icon className="mx-auto h-5 w-5 text-lime-300" />
                    <p className="mt-2 font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">{String(label)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-lime-300/20 bg-[#1f1f21] p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <RotateCcw className="mt-0.5 h-5 w-5 text-lime-300" />
                <div>
                  <p className="text-sm font-bold text-white">Order with clarity</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">Review your cart, contact information, delivery address, and payment preference before sending the order.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <CartDrawer storeSlug={storeSlug} />
    </div>
  );
}
