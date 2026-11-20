export const numberFormatter = new Intl.NumberFormat("en-US");
export const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const sparklineSets = [
  [12, 14, 13, 16, 17, 18, 21],
  [7, 8, 10, 11, 13, 12, 15],
  [11, 10, 9, 8, 9, 7, 8],
  [5, 7, 6, 8, 10, 9, 11],
  [8, 9, 10, 11, 10, 12, 13],
];

export function toPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

export function formatChange(change: number): string {
  return `${change > 0 ? "+" : ""}${Math.round(change * 10) / 10}%`;
}

export function buildLinePath(points: number[], width: number, height: number): string {
  if (points.length === 0) return "";
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(max - min, 1);
  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((point - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json() as Promise<T>;
}
