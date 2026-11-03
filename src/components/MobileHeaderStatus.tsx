import React, { createContext, useContext } from 'react';
import { Clock } from 'lucide-react';

interface HeaderStatus {
  liveClock: string;
  roleBadgeLabel: string;
}

export const HeaderStatusContext = createContext<HeaderStatus | null>(null);

export const MobileHeaderStatus: React.FC = () => {
  const status = useContext(HeaderStatusContext);
  if (!status) return null;

  return (
    <div className="surface mt-3 flex w-fit max-w-full flex-wrap items-center gap-3 rounded-2xl px-3.5 py-2.5 lg:hidden">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF2F8] text-[#4C83B5]">
        <Clock className="h-4 w-4" />
      </span>
      <div className="pr-2">
        <p className="text-[9px] font-bold tracking-[.1em] text-[#6F7F8D]">WAKTU SAAT INI</p>
        <p className="text-base font-bold text-[#123B59] tabular-nums">{status.liveClock} WIB</p>
      </div>
      <span className="rounded-xl border border-[#E4EAF0] bg-[#F4F6F8] px-3 py-2 text-xs font-semibold text-[#123B59]">
        {status.roleBadgeLabel}
      </span>
    </div>
  );
};
