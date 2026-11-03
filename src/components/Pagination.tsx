import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

export const PAGE_SIZE_OPTIONS = [6, 7, 10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 6;
const PAGE_GROUP_SIZE = 5;

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  startIndex: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const getPageNumbers = (page: number, totalPages: number): number[] => {
  const groupStart = Math.floor((page - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1;
  const groupEnd = Math.min(groupStart + PAGE_GROUP_SIZE - 1, totalPages);
  return Array.from({ length: groupEnd - groupStart + 1 }, (_, index) => groupStart + index);
};

const navBtnClass =
  'p-1.5 rounded-lg border border-[#E4EAF0] bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EAF2F8]';

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  startIndex,
  itemLabel = 'data',
  onPageChange,
  onPageSizeChange,
}) => {
  const from = totalItems === 0 ? 0 : startIndex + 1;
  const to = Math.min(startIndex + pageSize, totalItems);
  const groupStart = Math.floor((page - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1;
  const prevGroupPage = Math.max(1, groupStart - PAGE_GROUP_SIZE);
  const nextGroupPage = Math.min(totalPages, groupStart + PAGE_GROUP_SIZE);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[#E4EAF0] bg-[#F8FAFB] text-[11px] text-[#6F7F8D]">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Menampilkan{' '}
          <b className="text-[#123B59]">
            {from}–{to}
          </b>{' '}
          dari <b className="text-[#123B59]">{totalItems}</b> {itemLabel}
        </span>
        <label className="flex items-center gap-1">
          <span>Per halaman:</span>
          <select
            value={pageSize}
            onChange={event => onPageSizeChange(Number(event.target.value))}
            className="border border-[#E4EAF0] rounded-lg px-1.5 py-1 bg-white text-[#123B59] font-bold outline-none"
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(prevGroupPage)}
          disabled={groupStart <= 1}
          className={navBtnClass}
          aria-label="Grup halaman sebelumnya"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={navBtnClass}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {getPageNumbers(page, totalPages).map(pageNumber => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            aria-current={pageNumber === page ? 'page' : undefined}
            className={`min-w-[28px] px-2 py-1 rounded-lg border font-bold tabular-nums transition ${
              pageNumber === page
                ? 'bg-[#28618F] border-[#28618F] text-white'
                : 'bg-white border-[#E4EAF0] text-[#123B59] hover:bg-[#EAF2F8]'
            }`}
          >
            {pageNumber}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={navBtnClass}
          aria-label="Halaman berikutnya"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(nextGroupPage)}
          disabled={groupStart + PAGE_GROUP_SIZE > totalPages}
          className={navBtnClass}
          aria-label="Grup halaman berikutnya"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
