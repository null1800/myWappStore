import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AddToCartButton } from '@/components/storefront/AddToCartButton';
import { CartDrawer } from '@/components/storefront/CartDrawer';

async function getProduct(storeSlug: string, productSlug: string) {
  try {
    // Use the stores endpoint for public product listing then find by slug
    const { data } = await publicApi.get(`/stores/${storeSlug}/products`, {
      params: { limit: 100 },
    });
    const product = data.data.find((p: any) => p.slug === productSlug);
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
    <div className="container-page py-8">
      <Link
        href={`/${storeSlug}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--brand)] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to store
      </Link>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Images */}
        <div>
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-[var(--surface-3)]">
            {product.images?.[0] ? (
              <Image
                src={product.images[0]}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-6xl">📦</div>
            )}
            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="bg-black/70 text-white px-4 py-2 rounded-full font-medium">
                  Out of Stock
                </span>
              </div>
            )}
          </div>

          {/* Thumbnail row for multiple images */}
          {product.images?.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {product.images.slice(0, 6).map((img: string, i: number) => (
                <div key={i} className="w-16 h-16 rounded-lg overflow-hidden bg-[var(--surface-3)] shrink-0">
                  <Image src={img} alt={`${product.name} ${i + 1}`} width={64} height={64} className="object-cover w-full h-full" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          {product.category && (
            <Link
              href={`/${storeSlug}?category=${product.category.id}`}
              className="text-xs font-medium text-[var(--brand)] uppercase tracking-widest mb-3 hover:underline w-fit"
            >
              {product.category.name}
            </Link>
          )}

          <h1 className="text-3xl font-display font-bold text-[var(--text-primary)] leading-tight mb-4">
            {product.name}
          </h1>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-3xl font-bold text-[var(--text-primary)]">
              {formatCurrency(product.price)}
            </span>
            {product.compareAtPrice && (
              <span className="text-lg text-[var(--text-muted)] line-through">
                {formatCurrency(product.compareAtPrice)}
              </span>
            )}
            {product.compareAtPrice && (
              <span className="badge badge-red text-xs">
                {Math.round((1 - parseFloat(product.price) / parseFloat(product.compareAtPrice)) * 100)}% off
              </span>
            )}
          </div>

          {/* Stock indicator */}
          {product.trackInventory && (
            <p className={`text-sm font-medium mb-5 ${
              product.stockQuantity === 0 ? 'text-red-500' :
              product.stockQuantity <= 5 ? 'text-amber-600' : 'text-emerald-600'
            }`}>
              {product.stockQuantity === 0
                ? 'Out of stock'
                : product.stockQuantity <= 5
                  ? `Only ${product.stockQuantity} left in stock`
                  : 'In stock'}
            </p>
          )}

          {/* Description */}
          {product.description && (
            <p className="text-[var(--text-secondary)] leading-relaxed mb-6">
              {product.description}
            </p>
          )}

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {product.tags.map((tag: string) => (
                <span key={tag} className="badge badge-gray text-xs">{tag}</span>
              ))}
            </div>
          )}

          {/* Add to cart — client component */}
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
      </div>

      <CartDrawer storeSlug={storeSlug} />
    </div>
  );
}
