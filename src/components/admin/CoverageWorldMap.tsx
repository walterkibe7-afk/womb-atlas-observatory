"use client";

import { useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import worldTopology from "world-atlas/countries-110m.json";
import { buildCountryLookup, coverageBand } from "@/lib/admin/country-geo";

const VIEW = { width: 640, height: 320 };

type CountryFeature = Feature<Geometry, { name: string }>;

// The topology is static, so project every country once at module scope rather
// than on each render.
const COUNTRIES: { name: string; d: string }[] = (() => {
  const topology = worldTopology as unknown as Topology;
  const collection = feature(topology, topology.objects.countries) as unknown as {
    features: CountryFeature[];
  };

  // Antarctica dominates the frame and carries no observations — the Figma drops
  // it. Fit to what actually gets drawn, or it reserves empty space at the bottom.
  const drawn = collection.features.filter((f) => f.properties.name !== "Antarctica");

  const projection = geoNaturalEarth1().fitSize([VIEW.width, VIEW.height], {
    type: "FeatureCollection",
    features: drawn,
  } as never);
  const path = geoPath(projection);

  return drawn
    .map((f) => ({ name: f.properties.name, d: path(f) ?? "" }))
    .filter((c) => c.d !== "");
})();

export function CoverageWorldMap({
  countryList,
}: {
  countryList: { country: string; observationCount: number }[];
}) {
  const { lookup, max } = useMemo(
    () => ({
      lookup: buildCountryLookup(countryList),
      max: Math.max(0, ...countryList.map((c) => c.observationCount)),
    }),
    [countryList],
  );

  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      className="h-full w-full"
      role="img"
      aria-label="World map shaded by observation coverage per country"
    >
      {COUNTRIES.map(({ name, d }) => {
        const count = lookup(name);
        const band = coverageBand(count, max);
        return (
          <path
            key={name}
            d={d}
            fill={band.color}
            // A hairline of the surface colour keeps neighbouring countries apart
            // even when they land in the same band.
            stroke="var(--color-surface-inset)"
            strokeWidth={0.4}
            className="transition-opacity hover:opacity-80"
          >
            <title>
              {name} — {band.label}
              {count > 0 ? ` (${count.toLocaleString()} observations)` : ""}
            </title>
          </path>
        );
      })}
    </svg>
  );
}
