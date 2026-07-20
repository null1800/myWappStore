import { notFound } from 'next/navigation';
import { publicApi } from '@/lib/api';
import { StorefrontClient } from '@/components/storefront/StorefrontClient';

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
}

export const dynamic = 'force-dynamic';

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
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;

  const result = await getStoreData(storeSlug);
  if (!result) notFound();

  const { store, products } = result;

  // Inactive stores get a polite "closed" page — not a 404
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

  return (
    <StorefrontClient
      storeSlug={storeSlug}
      store={store}
      products={products}
    />
  );
}
