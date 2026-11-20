import type { LucideIcon } from "lucide-react";

const SIZE = 120;
const C = SIZE / 2;
const RING = 50;

// Deterministic constellation: fixed angles and radii rather than random ones,
// so the glyph is identical on the server and the client (a random layout would
// hydrate mismatched) and stable between renders.
const STARS = [
  { a: -90, r: 50, s: 2.6 },
  { a: -52, r: 44, s: 1.6 },
  { a: -18, r: 51, s: 2.2 },
  { a: 14, r: 41, s: 1.4 },
  { a: 48, r: 50, s: 2.8 },
  { a: 78, r: 43, s: 1.5 },
  { a: 110, r: 51, s: 2 },
  { a: 146, r: 45, s: 1.5 },
  { a: 178, r: 50, s: 2.4 },
  { a: 212, r: 42, s: 1.4 },
  { a: 246, r: 51, s: 2.1 },
  { a: 288, r: 46, s: 1.7 },
];

/** Indices into STARS, joined into short constellation runs. */
const LINKS = [
  [0, 1, 2],
  [4, 5, 6],
  [8, 9, 10],
];

const pt = (a: number, r: number) => {
  const rad = (a * Math.PI) / 180;
  return { x: C + Math.cos(rad) * r, y: C + Math.sin(rad) * r };
};

/**
 * The circular constellation medallion that fronts each core-insight card: a
 * faint starfield ring with the card's icon at its centre.
 *
 * Decorative only — `aria-hidden`, with the meaning carried by the heading
 * beside it. `id`s are namespaced per instance because two glyphs render on the
 * same page and SVG gradient ids are global: sharing one would make the second
 * card silently adopt the first card's fill.
 */
export function InsightGlyph({
  icon: Icon,
  id,
  className,
}: {
  icon: LucideIcon;
  /** Unique per instance — namespaces the gradient ids. */
  id: string;
  className?: string;
}) {
  const glow = `glyph-glow-${id}`;
  const ring = `glyph-ring-${id}`;

  return (
    <span className={`relative grid shrink-0 place-items-center ${className ?? ""}`} aria-hidden="true">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" fill="none">
        <defs>
          <radialGradient id={glow} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-brand-gold)" stopOpacity="0.16" />
            <stop offset="55%" stopColor="var(--color-brand-purple)" stopOpacity="0.07" />
            <stop offset="100%" stopColor="var(--color-brand-gold)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={ring} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-gold)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--color-brand-purple)" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        <circle cx={C} cy={C} r={RING + 8} fill={`url(#${glow})`} />
        <circle cx={C} cy={C} r={RING + 6} stroke={`url(#${ring})`} strokeWidth="1" />

        {LINKS.map((run, i) => (
          <polyline
            key={i}
            points={run.map((idx) => { const p = pt(STARS[idx].a, STARS[idx].r); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(" ")}
            stroke="var(--color-brand-gold)"
            strokeOpacity="0.28"
            strokeWidth="0.8"
            fill="none"
          />
        ))}

        {STARS.map((star, i) => {
          const p = pt(star.a, star.r);
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={star.s}
              fill="var(--color-brand-gold)"
              fillOpacity={star.s > 2 ? 0.85 : 0.45}
            />
          );
        })}
      </svg>

      <span className="absolute inset-0 grid place-items-center text-brand-gold">
        <Icon size="38%" strokeWidth={1.1} className="h-[38%] w-[38%]" />
      </span>
    </span>
  );
}
