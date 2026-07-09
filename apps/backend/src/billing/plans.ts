// ─────────────────────────────────────────────────────────────────────────────
// PLAN DEFINITIONS — single source of truth for limits, pricing, and features.
//
// All plan enforcement in the API reads from this file. To change a limit,
// change it here; no query changes needed. To add a plan, add an entry here
// and update the PLANS array.
//
// Pricing is in ZMW tambala (smallest unit, like kobo for NGN) so integer
// arithmetic works cleanly with Paystack's API. 1 ZMW = 100 tambala.
// ─────────────────────────────────────────────────────────────────────────────

export type PlanId = 'free' | 'starter' | 'pro';

export interface PlanLimits {
  maxProducts: number;           // -1 = unlimited
  maxStaffUsers: number;         // -1 = unlimited (not counting owner)
  maxOrdersPerMonth: number;     // -1 = unlimited
  analyticsRetentionDays: number; // how far back reports go
  customDomain: boolean;
  variantsEnabled: boolean;
  reportsEnabled: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceTambalaMonthly: number;  // 0 for free
  priceTambalaYearly: number;   // 0 for free
  limits: PlanLimits;
  description: string;
  highlighted: boolean;         // shown as "recommended" in UI
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    priceTambalaMonthly: 0,
    priceTambalaYearly: 0,
    description: 'Get started — no credit card required.',
    highlighted: false,
    limits: {
      maxProducts: 10,
      maxStaffUsers: 0,           // owner only
      maxOrdersPerMonth: 50,
      analyticsRetentionDays: 7,
      customDomain: false,
      variantsEnabled: false,
      reportsEnabled: false,
    },
  },

  starter: {
    id: 'starter',
    name: 'Starter',
    priceTambalaMonthly: 14900,  // ZMW 149/month
    priceTambalaYearly:  149000, // ZMW 1,490/year (~17% discount)
    description: 'For growing businesses that need more products and staff.',
    highlighted: true,
    limits: {
      maxProducts: 100,
      maxStaffUsers: 3,
      maxOrdersPerMonth: 500,
      analyticsRetentionDays: 30,
      customDomain: false,
      variantsEnabled: true,
      reportsEnabled: true,
    },
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    priceTambalaMonthly: 34900,  // ZMW 349/month
    priceTambalaYearly:  349000, // ZMW 3,490/year
    description: 'Unlimited scale for established businesses.',
    highlighted: false,
    limits: {
      maxProducts: -1,
      maxStaffUsers: -1,
      maxOrdersPerMonth: -1,
      analyticsRetentionDays: 90,
      customDomain: true,
      variantsEnabled: true,
      reportsEnabled: true,
    },
  },
};

export function getPlan(planId: string): PlanDefinition {
  return PLANS[planId as PlanId] ?? PLANS.free;
}

// Human-readable ZMW amount from tambala
export function formatTambala(tambala: number): string {
  return `ZMW ${(tambala / 100).toFixed(2)}`;
}
