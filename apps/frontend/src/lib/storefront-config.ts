export interface StorefrontSection {
  id: string;
  type: 'products' | 'promo-banner' | 'testimonials' | 'stats-bar' | 'feature-grid' | 'newsletter-cta' | 'about-bento';
  title?: string;
  subtitle?: string;
  filter?: 'latest' | 'featured' | 'trending' | 'best-sellers';
  limit?: number;
  imageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  enabled?: boolean;
  cardLayout?: 'grid' | 'carousel' | 'collage' | 'magazine' | 'list' | 'spotlight';
  testimonialStyle?: 'grid' | 'carousel';
  countdownEndsAt?: string;
  items?: Array<{
    name: string;
    role?: string;
    rating: number;
    content: string;
    avatarUrl?: string;
  }>;
}

export interface StorefrontConfig {
  announcement?: {
    enabled?: boolean;
    text?: string;
    link?: string;
  };
  navigation?: {
    logoUrl?: string;
    whatsappEnabled?: boolean;
    searchEnabled?: boolean;
  };
  hero?: {
    enabled?: boolean;
    heading?: string;
    subheading?: string;
    ctaText?: string;
    ctaLink?: string;
    bgImageUrl?: string;
    position?: 'left' | 'center' | 'right';
  };
  sections?: StorefrontSection[];
  footer?: {
    newsletterEnabled?: boolean;
    copyrightText?: string;
  };
}

export function parseStorefrontConfig(store: {
  headline: string | null;
  subtitle: string | null;
  bannerUrl: string | null;
  aboutText: string | null;
  logoUrl: string | null;
}): StorefrontConfig {
  const fallbackConfig: StorefrontConfig = {
    announcement: {
      enabled: true,
      text: '⚡ Welcome to our storefront • Quick Checkout via WhatsApp ⚡',
    },
    navigation: {
      logoUrl: store.logoUrl || undefined,
      whatsappEnabled: true,
      searchEnabled: true,
    },
    hero: {
      enabled: true,
      heading: store.headline || 'Welcome to our shop',
      subheading: store.subtitle || 'Browse our curated collection and place your order directly via WhatsApp.',
      ctaText: 'Browse Collection',
      ctaLink: '#products',
      bgImageUrl: store.bannerUrl || '',
      position: 'center',
    },
    sections: [
      {
        id: 'default-products',
        type: 'products',
        title: 'Featured Collection',
        subtitle: 'Products customers love',
        filter: 'latest',
        limit: 8,
        enabled: true,
      },
      {
        id: 'default-about',
        type: 'promo-banner',
        title: 'About Our Shop',
        subtitle: store.aboutText || 'We strive to provide premium quality products and direct chat-based communication for quick, personalized support.',
        imageUrl: store.bannerUrl || '',
        ctaText: 'Chat on WhatsApp',
        ctaLink: '#',
        enabled: true,
      }
    ],
    footer: {
      newsletterEnabled: true,
      copyrightText: '',
    }
  };

  if (!store.aboutText) {
    return fallbackConfig;
  }

  const trimmed = store.aboutText.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as StorefrontConfig;
      // Merge with fallbacks for safety
      return {
        announcement: { ...fallbackConfig.announcement, ...parsed.announcement },
        navigation: { ...fallbackConfig.navigation, ...parsed.navigation },
        hero: { ...fallbackConfig.hero, ...parsed.hero },
        sections: parsed.sections || fallbackConfig.sections,
        footer: { ...fallbackConfig.footer, ...parsed.footer },
      };
    } catch {
      // JSON syntax error, treat as legacy plain text
      return fallbackConfig;
    }
  }

  return fallbackConfig;
}
