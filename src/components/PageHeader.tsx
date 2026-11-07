import React from 'react';
import { MobileHeaderStatus } from './MobileHeaderStatus';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, title, description, children }) => (
  <header className="flex min-w-0 flex-col gap-4 rounded-3xl bg-gradient-to-br from-[#123B59] to-[#285F85] p-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
    <div className="min-w-0">
      <p className="text-xs font-bold tracking-[.16em] text-sky-200">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">{description}</p>}
    </div>
    <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
      <MobileHeaderStatus showOnDesktop />
      {children}
    </div>
  </header>
);
