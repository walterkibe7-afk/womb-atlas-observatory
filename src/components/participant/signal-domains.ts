import {
  Droplet,
  Zap,
  Activity,
  RefreshCw,
  Battery,
  Stethoscope,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

import { NARRATIVE_DOMAIN } from "@/lib/observation/signal-types";
import { v43Text } from "@/lib/observation/intelligence/v43/v43-i18n";

export { NARRATIVE_DOMAIN, SIGNAL_TYPE_DOMAIN, signalTypeDomain } from "@/lib/observation/signal-types";

// Stable colours per constellation domain for the Signal Evolution chart +
// sparklines — drawn from the fixed 7-colour participant palette (each of the
// 6 non-Ink swatches used exactly once) so per-domain lines stay distinct.
export const DOMAIN_COLORS: Record<string, string> = {
  Bleeding: "#4A2438",     // Plum
  Pain: "#B07F58",         // Copper
  Hormonal: "#C89A52",     // Gold
  Cycle: "#A28798",        // Mauve
  "Daily Life": "#D8C9B5", // Sand
  "Care Access": "#3A1A2C", // Aubergine
  [NARRATIVE_DOMAIN]: "#B07F58", // Copper, shared with Pain — narrative rows
  // are always labelled, so the repeat reads as a family rather than a clash.
};

export const DOMAIN_ICON: Record<string, LucideIcon> = {
  Bleeding: Droplet,
  Pain: Zap,
  Hormonal: Activity,
  Cycle: RefreshCw,
  "Daily Life": Battery,
  "Care Access": Stethoscope,
  [NARRATIVE_DOMAIN]: MessageCircle,
};

export function domainColor(domain: string): string {
  return DOMAIN_COLORS[domain] ?? "#C89A52";
}

// Bridges this domain-label keyspace ("Bleeding", "Cycle", …) to the
// constellation nodeId keyspace used by ConstellationNodeContent /
// AtlasConstellationMap ("bleeding", "cycle_disruption", …) — kept in one
// place so the dashboard preview and the My Records constellation always
// point at the same icon/node for a given domain.
export const DOMAIN_TO_NODE_ID: Record<string, string> = {
  Bleeding: "bleeding",
  Pain: "pain",
  Hormonal: "hormonal",
  Cycle: "cycle_disruption",
  "Daily Life": "daily_life",
  "Care Access": "care_access",
};

export const NODE_ID_TO_DOMAIN: Record<string, string> = Object.fromEntries(
  Object.entries(DOMAIN_TO_NODE_ID).map(([domain, nodeId]) => [nodeId, domain]),
);

// `domain` here is the fixed English key ("Bleeding", "Cycle", …) used
// throughout as a lookup into DOMAIN_COLORS/DOMAIN_ICON/DOMAIN_TO_NODE_ID —
// never translate that key. This resolves the display-only label for it.
// Exported so other domain-keyed translations (e.g. summary.ts's
// DOMAIN_COMPANION insight phrases) can reuse the same v43Text id per domain.
export const DOMAIN_TRANSLATION_ID: Record<string, string> = {
  Bleeding: "domain_bleeding",
  Pain: "domain_pain",
  Hormonal: "domain_hormonal",
  Cycle: "domain_cycle",
  "Daily Life": "domain_daily_life",
  "Care Access": "domain_care_access",
  [NARRATIVE_DOMAIN]: "domain_narrative",
};

export function domainLabel(domain: string, locale?: string): string {
  const id = DOMAIN_TRANSLATION_ID[domain];
  if (!id) return domain;
  return v43Text(id, "label", domain, locale);
}
