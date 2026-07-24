import type { ProductAttributes } from './storefront.types';

export const PREDEFINED_DISPLAY_TYPES: Record<string, { label: string; class: string }> = {
  featured:         { label: 'Featured',        class: 'bg-amber-400/90 text-amber-950' },
  'best seller':    { label: 'Best Seller',     class: 'bg-orange-500/90 text-white' },
  'new arrival':    { label: 'New Arrival',     class: 'bg-blue-500/90 text-white' },
  latest:           { label: 'Latest',          class: 'bg-emerald-500/90 text-white' },
  'most popular':   { label: 'Most Popular',    class: 'bg-purple-500/90 text-white' },
  recommended:      { label: 'Recommended',     class: 'bg-teal-500/90 text-white' },
  'on sale':        { label: 'On Sale',         class: 'bg-red-500/90 text-white' },
  'limited edition':{ label: 'Limited Edition', class: 'bg-indigo-600/90 text-white font-black' },
};

export function parseProductAttributes(tags?: string[]): ProductAttributes {
  if (!tags) return { colors: [], sizes: [], customAttributes: [], dynamicFields: {} };
  const metaTag = tags.find((tag) => tag.startsWith('__meta:'));
  if (!metaTag) return { colors: [], sizes: [], customAttributes: [], dynamicFields: {} };

  try {
    const parsed = JSON.parse(metaTag.replace('__meta:', '')) as ProductAttributes;
    // Ensure dynamicFields always exists even on older products
    return { dynamicFields: {}, ...parsed };
  } catch {
    return { colors: [], sizes: [], customAttributes: [], dynamicFields: {} };
  }
}
