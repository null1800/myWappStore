'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  LogOut,
  Store,
  Menu,
  X,
  BarChart2,
  UserCog,
  CreditCard,
  FolderOpen,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/dashboard',           label: 'Overview',  icon: LayoutDashboard, ownerOnly: false },
  { href: '/dashboard/products',  label: 'Products',  icon: Package,         ownerOnly: false },
  { href: '/dashboard/orders',    label: 'Orders',    icon: ShoppingCart,    ownerOnly: false },
  { href: '/dashboard/customers', label: 'Customers', icon: Users,           ownerOnly: false },
  { href: '/dashboard/reports',   label: 'Reports',   icon: BarChart2,       ownerOnly: true  },
  { href: '/dashboard/staff',     label: 'Staff',     icon: UserCog,         ownerOnly: true  },
  { href: '/dashboard/store',     label: 'My Store',  icon: Settings,        ownerOnly: false },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, tenant, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (_) {}
    logout();
    router.push('/login');
  };

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {NAV_ITEMS
        .filter(({ ownerOnly }) => !ownerOnly || user?.role === 'OWNER')
        .map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-[var(--brand)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
    </nav>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[var(--border)]">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
          <div className="w-8 h-8 rounded-lg bg-[var(--brand)] flex items-center justify-center shrink-0">
            <Store className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--text-primary)] truncate">
              {tenant?.name ?? 'My Store'}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] truncate">
              mywappstore.com/{tenant?.slug}
            </p>
          </div>
        </Link>
      </div>

      <NavLinks />

      {/* User footer */}
      <div className="px-3 py-4 border-t border-[var(--border)]">
        {/* View storefront link */}
        {tenant?.slug && (
          <Link
            href={`/${tenant.slug}`}
            target="_blank"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--brand)] transition-all mb-1"
          >
            <Store className="w-4 h-4 shrink-0" />
            View Storefront
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
        <div className="mt-3 px-3">
          <p className="text-xs font-medium text-[var(--text-primary)] truncate">
            {user?.fullName ?? user?.email}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] truncate capitalize">
            {user?.role?.toLowerCase() ?? 'owner'}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 bg-[var(--surface-1)] border-r border-[var(--border)]">
        <SidebarContent />
      </aside>

      {/* Mobile topbar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[var(--surface-1)] border-b border-[var(--border)] sticky top-0 z-30">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--brand)] flex items-center justify-center">
            <Store className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-[var(--text-primary)]">
            {tenant?.name ?? 'Dashboard'}
          </span>
        </Link>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-2)] transition-colors"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-[var(--surface-1)] h-full shadow-xl flex flex-col">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}
