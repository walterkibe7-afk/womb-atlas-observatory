import { Loader2 } from "lucide-react";

/**
 * Route-level loading fallback (used by each route's `loading.tsx`). Next.js
 * swaps this in automatically while a route segment's chunk/data loads, so
 * navigating between pages always shows feedback instead of a blank pause.
 */
export function PageLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-brand-gold" />
    </div>
  );
}
