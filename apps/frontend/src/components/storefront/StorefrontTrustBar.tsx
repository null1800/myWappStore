import { HeartHandshake, ShieldCheck, Sparkles, Truck } from 'lucide-react';

export function StorefrontTrustBar() {
  const items = [
    { Icon: ShieldCheck, title: 'Secure Checkout', sub: 'Encrypted & safe' },
    { Icon: Truck, title: 'Fast Delivery', sub: 'Order via WhatsApp' },
    { Icon: HeartHandshake, title: '24/7 Support', sub: 'Direct chat access' },
    { Icon: Sparkles, title: 'Quality Assured', sub: 'Curated catalog' },
  ];

  return (
    <section className="py-10 border-y border-slate-200 bg-white" aria-label="Store trust signals">
      <div className="container-page flex flex-wrap justify-center md:justify-between gap-6 items-center">
        {items.map(({ Icon, title, sub }) => (
          <div key={title} className="flex items-center gap-4 group">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 transition-colors group-hover:border-[var(--brand)]">
              <Icon className="w-6 h-6 text-[var(--brand)]" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">{title}</p>
              <p className="text-xs text-slate-500">{sub}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
