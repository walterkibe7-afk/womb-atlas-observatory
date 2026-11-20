"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

interface TablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  /** Singular noun for the summary line, e.g. "user" → "12 users". */
  itemLabel?: string;
  /** Override when the plural isn't just `itemLabel + "s"` (e.g. "log entries"). */
  itemLabelPlural?: string;
}

/** Page numbers around the current page, with `null` marking an ellipsis gap. */
function buildPageList(page: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const visible = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const withGaps: (number | null)[] = [];
  visible.forEach((p, i) => {
    if (i > 0 && p - visible[i - 1] > 1) withGaps.push(null);
    withGaps.push(p);
  });
  return withGaps;
}

export function TablePagination({
  page,
  totalPages,
  total,
  pageSize,
  itemLabel = "result",
  itemLabelPlural
}: TablePaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const goToPage = (target: number) => {
    if (target === page || target < 1 || target > totalPages) return;
    const params = new URLSearchParams(searchParams.toString());
    if (target > 1) params.set("page", String(target));
    else params.delete("page");
    const queryString = params.toString();
    startTransition(() => router.replace(queryString ? `?${queryString}` : "?", { scroll: false }));
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-gray-400">
        Showing <span className="text-gray-200">{from}</span>–<span className="text-gray-200">{to}</span> of{" "}
        <span className="text-gray-200">{total}</span>{" "}
        {total === 1 ? itemLabel : itemLabelPlural ?? `${itemLabel}s`}
      </p>

      {totalPages > 1 && (
        <div className={`flex items-center gap-1 ${isPending ? "opacity-60" : ""}`}>
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="flex items-center gap-1 border border-[#3A2B4A] text-gray-300 px-3 py-1.5 rounded-lg text-sm hover:text-white hover:bg-[#2A1F36] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-300 transition-colors"
          >
            <ChevronLeft size={14} />
            <span className="hidden sm:inline">Prev</span>
          </button>

          {buildPageList(page, totalPages).map((entry, index) =>
            entry === null ? (
              <span key={`gap-${index}`} className="px-2 text-sm text-gray-500">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => goToPage(entry)}
                aria-current={entry === page ? "page" : undefined}
                className={`min-w-8 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                  entry === page
                    ? "bg-blue-900/30 text-blue-400 border border-blue-800"
                    : "border border-transparent text-gray-400 hover:text-white hover:bg-[#2A1F36]"
                }`}
              >
                {entry}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="flex items-center gap-1 border border-[#3A2B4A] text-gray-300 px-3 py-1.5 rounded-lg text-sm hover:text-white hover:bg-[#2A1F36] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-300 transition-colors"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
