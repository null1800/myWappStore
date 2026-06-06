import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--surface-2)] flex items-center justify-center px-4">
      <div className="text-center animate-fade-up">
        <p className="text-7xl font-display font-bold text-[var(--brand)] mb-4">404</p>
        <h1 className="text-2xl font-display font-bold text-[var(--text-primary)] mb-2">Page not found</h1>
        <p className="text-[var(--text-secondary)] mb-8">
          This page doesn't exist or the store may have moved.
        </p>
        <Link href="/" className="btn-primary">Go home</Link>
      </div>
    </div>
  );
}
