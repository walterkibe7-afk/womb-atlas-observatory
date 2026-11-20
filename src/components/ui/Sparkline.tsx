// Lightweight inline-SVG sparkline matching the design's polyline treatment.
// Deliberately dependency-free (no recharts) so it's cheap to render in lists.
export function Sparkline({
  data,
  color = "var(--color-brand-purple)",
  width = 70,
  height = 18,
  strokeWidth = 1.6,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  const pad = strokeWidth;
  const points = toPoints(data, width, height, pad);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth={strokeWidth} points={points} />
    </svg>
  );
}

function toPoints(data: number[], width: number, height: number, pad: number): string {
  if (!data.length) return "";
  if (data.length === 1) {
    const y = height / 2;
    return `${pad},${y} ${width - pad},${y}`;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  return data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * innerW;
      // Higher value → higher on screen (smaller y).
      const y = pad + innerH - ((v - min) / span) * innerH;
      return `${round(x)},${round(y)}`;
    })
    .join(" ");
}

const round = (n: number) => Math.round(n * 10) / 10;
