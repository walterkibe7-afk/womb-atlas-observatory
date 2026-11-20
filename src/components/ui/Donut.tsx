import type { ReactNode } from "react";

/** One slice of a part-to-whole donut. `value` is in any unit — shares are computed. */
export type DonutSegment = { value: number; color: string; label: string };

/** Gap between adjacent fills, in degrees — the mark spec's 2px surface spacer. */
const SEGMENT_GAP_DEG = 2;

/**
 * Conic-gradient progress ring with a punched-out center, matching the design's
 * return-rate / data-quality donuts. `percent` is 0–100. Center content is free
 * (usually the percentage in Spectral).
 *
 * Pass `segments` instead for a part-to-whole breakdown (identity, not
 * magnitude): each slice is drawn in its own categorical hue, separated by a
 * hairline of the surface colour so adjacent fills never touch. Segments always
 * need a labelled legend beside them — colour alone is not an encoding.
 */
export function Donut({
  percent,
  segments,
  size = 94,
  thickness = 12,
  color = "var(--color-brand-gold)",
  track = "var(--color-border-subtle)",
  centerBg = "var(--color-surface)",
  rounded = false,
  children,
}: {
  percent?: number;
  segments?: DonutSegment[];
  size?: number;
  thickness?: number;
  color?: string;
  track?: string;
  centerBg?: string;
  /** Render as an SVG ring with rounded arc ends (conic gradient can't cap). */
  rounded?: boolean;
  children?: ReactNode;
}) {
  const p = Math.max(0, Math.min(100, percent ?? 0));
  const inner = size - thickness * 2;

  if (segments?.length) {
    const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
    let cursor = 0;
    const stops: string[] = [];

    for (const segment of segments) {
      const sweep = total > 0 ? (Math.max(0, segment.value) / total) * 360 : 0;
      if (sweep <= 0) continue;
      // Inset each fill by half a gap on both sides, and let the surface colour
      // show through between them.
      const start = cursor + SEGMENT_GAP_DEG / 2;
      const end = cursor + sweep - SEGMENT_GAP_DEG / 2;
      if (end > start) {
        stops.push(`${centerBg} ${cursor}deg ${start}deg`);
        stops.push(`${segment.color} ${start}deg ${end}deg`);
        stops.push(`${centerBg} ${end}deg ${cursor + sweep}deg`);
      }
      cursor += sweep;
    }
    // Nothing to show (all-zero data) — fall back to a flat track ring.
    const background = stops.length
      ? `conic-gradient(${stops.join(", ")})`
      : `conic-gradient(${track} 0deg 360deg)`;

    return (
      <div
        className="mx-auto flex items-center justify-center rounded-full"
        style={{ width: size, height: size, background }}
      >
        <div
          className="flex flex-col items-center justify-center rounded-full text-center"
          style={{ width: inner, height: inner, background: centerBg }}
        >
          {children}
        </div>
      </div>
    );
  }

  // SVG stroke path: rounded line caps give the arc softly rounded ends and a
  // transparent centre (the card shows through — no punch-out needed).
  if (rounded) {
    const r = (size - thickness) / 2;
    const circ = 2 * Math.PI * r;
    const dash = (p / 100) * circ;
    return (
      <div className="relative flex items-center justify-center mx-auto" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center mx-auto"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} 0% ${p}%, ${track} ${p}% 100%)`,
      }}
    >
      <div
        className="rounded-full flex flex-col items-center justify-center text-center"
        style={{ width: inner, height: inner, background: centerBg }}
      >
        {children}
      </div>
    </div>
  );
}
