'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Zap, Loader2, CreditCard, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  description: string;
  highlighted: boolean;
  priceMonthlyzMW: number;
  priceYearlyZMW: number;
  limits: {
    maxProducts: number;
    maxStaffUsers: number;
    maxOrdersPerMonth: number;
    analyticsRetentionDays: number;
    variantsEnabled: boolean;
    reportsEnabled: boolean;
  };
}

interface SubscriptionData {
  currentPlan: string;
  subscription: {
    status: string;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
    cancelledAt: string | null;
  } | null;
  plans: Plan[];
  paystackConfigured: boolean;
}

interface HistoryRow {
  id: string;
  plan: string;
  amountKobo: number;
  currency: string;
  createdAt: string;
}

function limitLabel(val: number): string {
  return val === -1 ? 'Unlimited' : val.toString();
}

export default function BillingPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/billing'),
      api.get('/billing/history'),
    ]).then(([sub, hist]) => {
      setData(sub.data.data);
      setHistory(hist.data.data ?? []);
    }).catch(() => toast.error('Failed to load billing information.'))
      .finally(() => setLoading(false));
  }, []);

  const upgrade = async (planId: string) => {
    if (!data?.paystackConfigured) {
      toast.error('Payment processing is not yet configured for this store.');
      return;
    }
    setUpgrading(planId);
    try {
      const { data: res } = await api.post('/billing/upgrade', {
        plan: planId,
        billingCycle,
      });
      window.location.href = res.data.authorizationUrl;
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to initiate payment.');
      setUpgrading(null);
    }
  };

  const cancel = async () => {
    if (!confirm('Cancel your subscription? You will keep access until the end of your billing period.')) return;
    setCancelling(true);
    try {
      const { data: res } = await api.post('/billing/cancel');
      toast.success(res.data.message);
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to cancel subscription.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  if (!data) return null;

  const currentPlan = data.plans.find((p) => p.id === data.currentPlan);
  const sub = data.subscription;

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Store Plan & Subscription</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          View your active plan, upgrade features, or check past payment receipts.
        </p>
      </div>

      {/* Current plan status */}
      <div className="card p-5 flex items-start gap-4">
        <div className="p-3 rounded-xl bg-[var(--brand)]/10 shrink-0">
          <Zap className="w-5 h-5 text-[var(--brand)]" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[var(--text-primary)]">
              {currentPlan?.name ?? data.currentPlan} Plan
            </p>
            {sub && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                sub.status === 'active' ? 'bg-green-100 text-green-700'
                : sub.status === 'cancelled' ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-700'
              }`}>
                {sub.status}
              </span>
            )}
          </div>
          {sub?.currentPeriodEnd && data.currentPlan !== 'free' && (
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {sub.cancelledAt
                ? `Access until ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                : `Renews ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`}
            </p>
          )}
        </div>
        {sub && data.currentPlan !== 'free' && !sub.cancelledAt && (
          <button
            onClick={cancel}
            disabled={cancelling}
            className="text-sm text-red-500 hover:text-red-700 transition-colors shrink-0"
          >
            {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancel'}
          </button>
        )}
      </div>

      {/* Billing cycle toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-[var(--text-secondary)]">Billing:</span>
        <div className="flex rounded-xl overflow-hidden border border-[var(--border)]">
          {(['monthly', 'yearly'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setBillingCycle(c)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors capitalize ${
                billingCycle === c
                  ? 'bg-[var(--brand)] text-white'
                  : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--background)]'
              }`}
            >
              {c}
              {c === 'yearly' && (
                <span className="ml-1.5 text-xs opacity-80">Save ~17%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.plans.map((plan) => {
          const isCurrent = plan.id === data.currentPlan;
          const price = billingCycle === 'yearly' ? plan.priceYearlyZMW : plan.priceMonthlyzMW;

          return (
            <div
              key={plan.id}
              className={`card p-6 flex flex-col gap-4 relative ${
                plan.highlighted ? 'ring-2 ring-[var(--brand)]' : ''
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[var(--brand)] text-white text-xs font-semibold rounded-full">
                  Recommended
                </div>
              )}

              <div>
                <p className="font-bold text-lg text-[var(--text-primary)]">{plan.name}</p>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">{plan.description}</p>
              </div>

              <div>
                {price === 0 ? (
                  <p className="text-3xl font-bold text-[var(--text-primary)]">Free</p>
                ) : (
                  <p className="text-3xl font-bold text-[var(--text-primary)]">
                    ZMW {price.toFixed(0)}
                    <span className="text-base font-normal text-[var(--text-muted)]">
                      /{billingCycle === 'yearly' ? 'yr' : 'mo'}
                    </span>
                  </p>
                )}
              </div>

              <ul className="space-y-2 flex-1 text-sm">
                {[
                  `${limitLabel(plan.limits.maxProducts)} products`,
                  `${limitLabel(plan.limits.maxOrdersPerMonth)} orders/month`,
                  `${plan.limits.maxStaffUsers === 0 ? 'No' : limitLabel(plan.limits.maxStaffUsers)} staff accounts`,
                  `${plan.limits.analyticsRetentionDays}-day reports`,
                  plan.limits.variantsEnabled ? 'Product variants' : null,
                  plan.limits.reportsEnabled ? 'Advanced reports' : null,
                ].filter(Boolean).map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <CheckCircle className="w-4 h-4 text-[var(--brand)] shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="py-2.5 text-center text-sm font-medium text-[var(--text-muted)] border border-[var(--border)] rounded-xl">
                  Current plan
                </div>
              ) : plan.id === 'free' ? (
                <div className="py-2.5 text-center text-xs text-[var(--text-muted)]">
                  Downgrade by cancelling your subscription
                </div>
              ) : (
                <button
                  onClick={() => upgrade(plan.id)}
                  disabled={!!upgrading}
                  className="btn-primary py-2.5 flex items-center justify-center gap-2"
                >
                  {upgrading === plan.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <CreditCard className="w-4 h-4" />
                  }
                  Upgrade to {plan.name}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Billing history */}
      {history.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--brand)]" />
            <h2 className="font-semibold text-[var(--text-primary)]">Payment History</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {history.map((row) => (
              <div key={row.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)] capitalize">
                    {row.plan} plan
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  ZMW {(row.amountKobo / 100).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data.paystackConfigured && (
        <p className="text-xs text-center text-[var(--text-muted)]">
          Payment processing is not yet configured. Set <code>PAYSTACK_SECRET_KEY</code> in your backend environment to enable upgrades.
        </p>
      )}
    </div>
  );
}
