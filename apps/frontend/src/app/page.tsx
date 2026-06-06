import Link from 'next/link';
import { Store, MessageCircle, ShoppingBag, Zap, CheckCircle2, BarChart3, ShieldCheck } from 'lucide-react';

export default function PlatformHomePage() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-[var(--border)] bg-[var(--surface-1)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand)] flex items-center justify-center shadow-md">
              <Store className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-[var(--text-primary)] tracking-tight">MyWappStore</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost text-sm px-4 py-2">
              Sign In
            </Link>
            <Link href="/register" className="btn-primary text-sm px-4 py-2">
              Start Free Store
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden bg-gradient-to-b from-[var(--surface-1)] to-[var(--background)] border-b border-[var(--border)]">
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(var(--brand) 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}
        />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--brand-light)] text-[var(--brand)] text-xs font-semibold mb-6 animate-fade-up">
            <Zap className="w-3.5 h-3.5" /> No credit card required
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-[var(--text-primary)] tracking-tight max-w-4xl mx-auto leading-[1.1] animate-fade-up">
            Turn your WhatsApp into a <span className="text-[var(--brand)]">Sales Machine</span>
          </h1>
          
          <p className="mt-6 text-lg sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto animate-fade-up">
            Create a fast, beautiful online store, manage inventory, and receive structured customer orders directly on WhatsApp. Built for modern social sellers.
          </p>
          
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up">
            <Link href="/register" className="btn-primary text-base px-8 py-3.5 w-full sm:w-auto shadow-lg shadow-[var(--brand-light)]">
              Create My Store Now
            </Link>
            <Link href="/login" className="btn-secondary text-base px-8 py-3.5 w-full sm:w-auto">
              Dashboard Demo
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">How it works in 3 simple steps</h2>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] mt-2">No coding or complex setup required. Start selling today.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: 'Create Your Catalog',
              desc: 'Upload your products with descriptions, pricing, and stock limits. Categorize them to help customers find what they want.',
              icon: ShoppingBag,
            },
            {
              step: '02',
              title: 'Share Your Store URL',
              desc: 'Add your custom store link (mywappstore.com/your-store) to your WhatsApp Business bio, Instagram, TikTok, or Facebook.',
              icon: Zap,
            },
            {
              step: '03',
              title: 'Receive Orders on WhatsApp',
              desc: 'Customers browse your catalog, build a shopping cart, and check out. You receive a pre-formatted order details message directly on your WhatsApp.',
              icon: MessageCircle,
            },
          ].map(({ step, title, desc, icon: Icon }) => (
            <div key={step} className="card relative flex flex-col p-6 hover:shadow-md transition-shadow group">
              <div className="absolute top-4 right-6 text-3xl font-extrabold text-[var(--brand-light)] dark:text-[var(--surface-3)] select-none">
                {step}
              </div>
              <div className="w-12 h-12 rounded-xl bg-[var(--brand-light)] flex items-center justify-center text-[var(--brand)] mb-5 group-hover:scale-110 transition-transform">
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">{title}</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Showcase */}
      <section className="bg-[var(--surface-1)] border-y border-[var(--border)] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--brand)]">Powerful Dashboard</span>
              <h2 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight mt-2 mb-6">
                Everything you need to grow your social commerce business
              </h2>
              
              <ul className="space-y-4">
                {[
                  { title: 'Smart Inventory Management', desc: 'Set stock levels, track items automatically, and prevent over-selling with backorder settings.', icon: CheckCircle2 },
                  { title: 'WhatsApp Checkouts', desc: 'Generate a pre-filled message with item list, subtotal, and customer info so checkout is a 1-tap operation.', icon: MessageCircle },
                  { title: 'Rich Analytics', desc: 'Track sales, order status (Pending, Confirmed, Delivered), revenue trends, and customer details.', icon: BarChart3 },
                  { title: 'Secure & Instant setup', desc: 'Log in securely and update your storefront in real time. Your catalog is always up to date.', icon: ShieldCheck },
                ].map(({ title, desc, icon: Icon }) => (
                  <li key={title} className="flex gap-4">
                    <div className="mt-1 shrink-0 text-[var(--brand)]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-[var(--text-primary)]">{title}</h4>
                      <p className="text-sm text-[var(--text-secondary)] mt-0.5">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="relative">
              {/* Mock Dashboard UI Showcase */}
              <div className="border border-[var(--border)] rounded-2xl overflow-hidden shadow-2xl bg-[var(--background)] p-4 sm:p-6 space-y-4 max-w-md mx-auto">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <span className="text-xs text-[var(--text-muted)] font-mono">dashboard.mywappstore.com</span>
                </div>
                
                <div className="h-4 w-1/3 bg-[var(--surface-3)] rounded" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[var(--surface-1)] border border-[var(--border)] p-3 rounded-xl space-y-1">
                    <div className="h-3 w-1/2 bg-[var(--text-muted)] opacity-50 rounded" />
                    <div className="h-5 w-3/4 bg-[var(--text-primary)] rounded font-bold" />
                  </div>
                  <div className="bg-[var(--surface-1)] border border-[var(--border)] p-3 rounded-xl space-y-1">
                    <div className="h-3 w-1/2 bg-[var(--text-muted)] opacity-50 rounded" />
                    <div className="h-5 w-2/3 bg-[var(--text-primary)] rounded font-bold" />
                  </div>
                  <div className="bg-[var(--surface-1)] border border-[var(--border)] p-3 rounded-xl space-y-1">
                    <div className="h-3 w-1/2 bg-[var(--text-muted)] opacity-50 rounded" />
                    <div className="h-5 w-4/5 bg-[var(--text-primary)] rounded font-bold" />
                  </div>
                </div>

                <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-3 space-y-2">
                  <div className="h-3 w-1/4 bg-[var(--text-muted)] opacity-50 rounded" />
                  <div className="space-y-1.5 pt-1">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex justify-between items-center py-1.5 border-b border-[var(--border)] last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-[var(--surface-3)]" />
                          <div className="space-y-1">
                            <div className="h-2.5 w-16 bg-[var(--text-primary)] rounded" />
                            <div className="h-2 w-10 bg-[var(--text-muted)] rounded" />
                          </div>
                        </div>
                        <div className="h-3 w-8 bg-[var(--brand)] rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-[var(--brand)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">MyWappStore</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            &copy; {new Date().getFullYear()} MyWappStore. All rights reserved. Built for WhatsApp Social Commerce.
          </p>
        </div>
      </footer>
    </div>
  );
}
