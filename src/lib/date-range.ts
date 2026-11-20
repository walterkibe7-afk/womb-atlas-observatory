// Shared vocabulary for the dashboards' header date filter. The client sends
// `?range=<key>` (plus `?from=&to=` for a custom window); the server turns that
// into a date window. Keeping both halves here means a new preset — or a change
// to what "last 30 days" means — only has to be made in one place.

export type RangeKey = "7d" | "30d" | "90d" | "all" | "custom";

/** A resolved window. `null` on either side means unbounded in that direction. */
export type DateWindow = { from: Date | null; to: Date | null };

/**
 * The filter's client-side value. `from`/`to` are plain `YYYY-MM-DD` day
 * strings (what `<input type="date">` produces) and only apply to `custom`.
 */
export type DateRangeValue = { key: RangeKey; from?: string; to?: string };

export const RANGE_OPTIONS: { key: RangeKey; label: string; short: string }[] = [
  { key: "7d", label: "Last 7 days", short: "7 Days" },
  { key: "30d", label: "Last 30 days", short: "30 Days" },
  { key: "90d", label: "Last 90 days", short: "90 Days" },
  { key: "all", label: "All time", short: "All Time" },
  { key: "custom", label: "Custom range…", short: "Custom" },
];

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
const DAY_MS = 24 * 60 * 60 * 1000;

/** Coerce an untrusted `?range=` value to a known key (falls back to `all`). */
export function parseRange(param: string | null): RangeKey {
  if (param === "all" || param === "custom") return param;
  return param != null && param in RANGE_DAYS ? (param as RangeKey) : "all";
}

/**
 * `YYYY-MM-DD` -> a local Date at the start (or end) of that day. Returns null
 * for anything unparseable, so a malformed query string widens the window
 * rather than erroring or silently matching nothing.
 */
function parseDay(value: string | null | undefined, edge: "start" | "end"): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? "").trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const date =
    edge === "start"
      ? new Date(+y, +mo - 1, +d, 0, 0, 0, 0)
      : new Date(+y, +mo - 1, +d, 23, 59, 59, 999);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Resolve the window a request asks for. Presets look back from `now`; `custom`
 * uses the supplied day bounds (either may be omitted for an open-ended window,
 * and reversed bounds are swapped rather than rejected).
 */
export function parseWindow(params: URLSearchParams, now = new Date()): DateWindow {
  const key = parseRange(params.get("range"));

  if (key === "custom") {
    let from = parseDay(params.get("from"), "start");
    let to = parseDay(params.get("to"), "end");
    if (from && to && from > to) [from, to] = [to, from];
    return { from, to };
  }

  const days = RANGE_DAYS[key];
  return { from: days ? new Date(now.getTime() - days * DAY_MS) : null, to: null };
}

/** Prisma date filter for a window: `{}` when unbounded, so it can be spread. */
export function windowFilter(window: DateWindow, field = "createdAt") {
  const { from, to } = window;
  if (!from && !to) return {};
  return { [field]: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } };
}

/** True when `date` falls inside the window (used for in-memory filtering). */
export function inWindow(date: Date, window: DateWindow) {
  if (window.from && date < window.from) return false;
  if (window.to && date > window.to) return false;
  return true;
}

/* ── client helpers ───────────────────────────────────────────────────────── */

/** Query string for a filter value: `range=30d`, or `range=custom&from=…&to=…`. */
export function rangeQuery(value: DateRangeValue): string {
  const params = new URLSearchParams({ range: value.key });
  if (value.key === "custom") {
    if (value.from) params.set("from", value.from);
    if (value.to) params.set("to", value.to);
  }
  return params.toString();
}

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** What the header chip reads for a given value. */
export function rangeLabel(value: DateRangeValue): string {
  if (value.key !== "custom") {
    return RANGE_OPTIONS.find((o) => o.key === value.key)?.label ?? "All time";
  }
  const { from, to } = value;
  if (from && to) return `${dayLabel(from)} – ${dayLabel(to)}`;
  if (from) return `Since ${dayLabel(from)}`;
  if (to) return `Until ${dayLabel(to)}`;
  return "Custom range";
}
