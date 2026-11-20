"use client";

import { Filter, Loader2, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

const ROLE_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "participant", label: "Participant" },
  { value: "steward", label: "Steward" },
  { value: "analyst", label: "Analyst" },
  { value: "admin", label: "Administrator" },
];

export function AccessFilters({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const queryParam = searchParams.get("q") || "";
  const roleParam = searchParams.get("role") || "";

  const [query, setQuery] = useState(queryParam);
  // The value we last wrote to the URL, so the sync below can tell an external
  // navigation (back/forward) from the echo of our own debounced push — the
  // latter must not clobber keystrokes typed while that push was in flight.
  const [lastPushed, setLastPushed] = useState(queryParam);
  const [syncedParam, setSyncedParam] = useState(queryParam);

  if (syncedParam !== queryParam) {
    setSyncedParam(queryParam);
    if (queryParam !== lastPushed) {
      setLastPushed(queryParam);
      setQuery(queryParam);
    }
  }

  const buildUrl = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [name, value] of Object.entries(updates)) {
        if (value) params.set(name, value);
        else params.delete(name);
      }
      // Any filter change invalidates the current page offset.
      params.delete("page");
      const queryString = params.toString();
      return queryString ? `?${queryString}` : "?";
    },
    [searchParams]
  );

  // Debounce the search box so typing doesn't fire a query per keystroke.
  useEffect(() => {
    const next = query.trim();
    if (next === queryParam) return;
    const timer = setTimeout(() => {
      setLastPushed(next);
      startTransition(() => router.replace(buildUrl({ q: next }), { scroll: false }));
    }, 350);
    return () => clearTimeout(timer);
  }, [query, queryParam, buildUrl, router]);

  const hasFilters = Boolean(queryParam || roleParam);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center bg-[#1A1325] p-4 rounded-xl border border-[#3A2B4A]">
      <div className="relative w-full sm:w-96">
        {isPending ? (
          <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
        ) : (
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users by name, email or ID..."
          className="w-full bg-[#0F0C16] border border-[#3A2B4A] rounded-lg pl-10 pr-9 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={roleParam}
            onChange={(e) =>
              startTransition(() => router.replace(buildUrl({ role: e.target.value }), { scroll: false }))
            }
            aria-label="Filter by role"
            className="appearance-none bg-transparent border border-[#3A2B4A] text-gray-300 pl-9 pr-8 py-2 rounded-lg text-sm cursor-pointer hover:text-white hover:bg-[#2A1F36] focus:outline-none focus:border-blue-500 transition-colors"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-[#1A1325] text-white">
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              startTransition(() => router.replace("?", { scroll: false }));
            }}
            className="text-gray-400 hover:text-white px-2 py-2 text-sm transition-colors"
          >
            Clear
          </button>
        )}

        {children}
      </div>
    </div>
  );
}
