/** Formatting shared by the steward dashboard's data-backed cards. */

export const compact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);

/** "↑ 21%" / "↓ 5%" / "—" when there is no prior period to compare against. */
export const trendText = (pct: number | null | undefined) => {
  if (pct == null || pct === 0) return "—";
  return pct > 0 ? `↑ ${pct}%` : `↓ ${Math.abs(pct)}%`;
};

/** Growth is good, decline is not; a missing trend is neutral. */
export const trendTone = (pct: number | null | undefined) =>
  pct == null || pct === 0 ? "text-faint" : pct < 0 ? "text-brand-orange" : "text-brand-green";
