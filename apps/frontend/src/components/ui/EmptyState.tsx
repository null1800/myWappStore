import React, { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 py-16 bg-[var(--surface-2)] rounded-2xl border border-dashed border-[var(--border)] max-w-md mx-auto my-4 animate-fade-up">
      <div className="text-[var(--brand)] mb-4 flex items-center justify-center p-4 bg-[var(--brand-light)] rounded-full">
        {icon}
      </div>
      <h3 className="text-lg font-display font-semibold text-[var(--text-primary)] mb-1">
        {title}
      </h3>
      <p className="text-sm text-[var(--text-secondary)]">
        {description}
      </p>
    </div>
  );
}
