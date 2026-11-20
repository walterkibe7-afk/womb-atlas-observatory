// Joins the observatory's country data to world-atlas map geometry.
//
// The two sides name countries differently: `ParticipantContext.current_country`
// stores the English `Intl.DisplayNames` name chosen in the observation wizard
// ("United States", "Myanmar (Burma)"), while world-atlas polygons carry Natural
// Earth names ("United States of America", "Myanmar"). Every Natural Earth name
// our data can never produce is listed below — the list is exhaustive for the
// 110m dataset, so the join is total, not best-effort.
//
// Kosovo, N. Cyprus and Somaliland are deliberately absent: they have polygons
// but no ISO 3166-1 entry, so no observation can ever be filed against them.

/** Natural Earth name → the Intl.DisplayNames name our data actually stores. */
const NATURAL_EARTH_ALIASES: Record<string, string> = {
  "United States of America": "United States",
  "Bosnia and Herz.": "Bosnia & Herzegovina",
  "Central African Rep.": "Central African Republic",
  "Dominican Rep.": "Dominican Republic",
  "Eq. Guinea": "Equatorial Guinea",
  "Falkland Is.": "Falkland Islands",
  "Fr. S. Antarctic Lands": "French Southern Territories",
  "Solomon Is.": "Solomon Islands",
  "S. Sudan": "South Sudan",
  "W. Sahara": "Western Sahara",
  Congo: "Congo - Brazzaville",
  "Dem. Rep. Congo": "Congo - Kinshasa",
  "Côte d'Ivoire": "Côte d’Ivoire",
  Macedonia: "North Macedonia",
  Myanmar: "Myanmar (Burma)",
  Palestine: "Palestinian Territories",
  "Trinidad and Tobago": "Trinidad & Tobago",
  Turkey: "Türkiye",
  eSwatini: "Eswatini",
};

/** Case/punctuation-insensitive key — smooths over curly vs straight apostrophes. */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z]/g, "");
}

/**
 * Look up a country's observation count by its Natural Earth polygon name.
 * Returns 0 when the country has no observations (i.e. "No Data").
 */
export function buildCountryLookup(
  countryList: { country: string; observationCount: number }[],
): (naturalEarthName: string) => number {
  const byName = new Map<string, number>();
  for (const { country, observationCount } of countryList) {
    byName.set(normalize(country), observationCount);
  }

  return (naturalEarthName: string) => {
    const alias = NATURAL_EARTH_ALIASES[naturalEarthName] ?? naturalEarthName;
    return byName.get(normalize(alias)) ?? 0;
  };
}

/** Coverage bands, densest → sparsest. Index 4 is "No Data" (outside the ramp). */
export const COVERAGE_BANDS = [
  { label: "High", color: "var(--color-scale-1)" },
  { label: "Moderate", color: "var(--color-scale-2)" },
  { label: "Emerging", color: "var(--color-scale-3)" },
  { label: "Low", color: "var(--color-scale-4)" },
  { label: "No Data", color: "var(--color-scale-none)" },
] as const;

/**
 * Bucket a count into a coverage band. Thresholds are relative to the busiest
 * country, so the ramp stays meaningful whether the atlas holds ten
 * observations or ten million.
 */
export function coverageBand(count: number, max: number): (typeof COVERAGE_BANDS)[number] {
  if (count <= 0 || max <= 0) return COVERAGE_BANDS[4];
  const share = count / max;
  if (share > 0.6) return COVERAGE_BANDS[0];
  if (share > 0.35) return COVERAGE_BANDS[1];
  if (share > 0.15) return COVERAGE_BANDS[2];
  return COVERAGE_BANDS[3];
}
