// Constellation tap-node content — ported from participant-app
// (services/atlas-intelligence/constellation-node-content.ts). The mobile app
// recomputes this client-side from raw responses + an AIKB bundle; observatory-system
// already has the extracted AtlasObservationRecord[] + detected patterns from the
// pipeline (reflection-runner.ts), so this builds node content server-side, once,
// from that already-computed data.
import type { AtlasObservationRecord } from "../types";
import type { ReflectionSectionId } from "../sections";
import {
  buildOntologyRoutingContext,
  getPatternDefinition,
  participantLabelFor,
  routingsForPattern,
} from "./pattern-ontology";
import type { AtlasObservedPattern, AtlasPatternConnection } from "./atlas-intelligence-service";
import { v43Text } from "./v43-i18n";

export type ConstellationNodeConfidence = "light_baseline" | "emerging" | "strong";

export type ConstellationHotspotDefinition = {
  nodeId: string;
  label: string;
  left: string;
  top: string;
  linkedSections: ReflectionSectionId[];
  preferredPatterns: string[];
  domainPhrase: string;
};

export type ConstellationNodeContent = {
  nodeId: string;
  patternId: string;
  patternTitle: string;
  /** The hotspot's own domain label ("Bleeding", "Pain", …), translated —
   *  distinct from patternTitle, which names the specific detected pattern. */
  domainLabel: string;
  whatAtlasObserved: string;
  whyAtlasConnected: string;
  whatAtlasWillObserve: string;
  atlasNote: string;
  relatedPatterns: string[];
  confidenceLevel: ConstellationNodeConfidence;
  supportingObservations: string[];
};

const PATTERN_METADATA: Record<
  string,
  {
    watchOverTime: string;
    whyConnected: string;
  }
> = {
  "Bleeding Burden": {
    watchOverTime:
      "Future observations may show whether bleeding stays stable, becomes heavier or more unpredictable, or continues to affect energy, sleep, and daily preparation.",
    whyConnected:
      "Atlas grouped these observations because bleeding-related answers may connect with duration, clot burden, product changes, and how bleeding affects routines or energy.",
  },
  "Pain Distribution": {
    watchOverTime:
      "Future observations may show whether pain stays in one area, spreads across pelvic, bowel, bladder, or movement patterns, or becomes easier to anticipate.",
    whyConnected:
      "Atlas grouped these observations because pain timing, location, duration, and body-function answers may belong to the same lived experience rather than isolated events.",
  },
  "Hormonal Rhythm": {
    watchOverTime:
      "Future observations may show whether cycle rhythm becomes steadier, more changeable, or more clearly linked to other body signs.",
    whyConnected:
      "Atlas grouped these observations because cycle predictability, hormonal signs, and symptom timing may describe how rhythm and body changes travel together.",
  },
  "Body Unpredictability": {
    watchOverTime:
      "Future observations may show whether unpredictability eases, shifts across domains, or becomes easier to plan around.",
    whyConnected:
      "Atlas grouped these observations because answers about unpredictability and not knowing what comes next may form one uncertainty burden.",
  },
  "Daily Function": {
    watchOverTime:
      "Future observations may show whether routines become freer, more restricted, or more predictable as symptoms change.",
    whyConnected:
      "Atlas grouped these observations because missed activities, disrupted sleep, affected life areas, and functional impact may show how symptoms reorganize daily life.",
  },
  "Care Experience": {
    watchOverTime:
      "Future observations may show whether care access changes, whether diagnosis or treatment becomes clearer, whether barriers persist, or whether care experiences become less central over time.",
    whyConnected:
      "Atlas grouped these observations because they describe how you have navigated care alongside symptoms and daily life.",
  },
  "Pelvic Function": {
    watchOverTime:
      "Future observations may show whether pressure stays occasional, becomes more persistent, or connects more clearly with bowel, bladder, or movement patterns.",
    whyConnected:
      "Atlas grouped these observations because pelvic pressure, body-change signals, and location patterns may point to connected pelvic systems rather than one isolated symptom.",
  },
};

export const CONSTELLATION_HOTSPOTS: ConstellationHotspotDefinition[] = [
  {
    nodeId: "bleeding",
    label: "Bleeding",
    left: "14.8%",
    top: "27.5%",
    linkedSections: ["bleeding"],
    preferredPatterns: ["Bleeding Burden"],
    domainPhrase: "bleeding-related experiences",
  },
  {
    nodeId: "pain",
    label: "Pain",
    left: "50.7%",
    top: "12.5%",
    linkedSections: ["pain", "sensitive"],
    preferredPatterns: ["Pain Distribution", "Pelvic Function"],
    domainPhrase: "pain and pelvic discomfort",
  },
  {
    nodeId: "hormonal",
    label: "Hormonal",
    left: "88.7%",
    top: "29.2%",
    linkedSections: ["hormonal"],
    preferredPatterns: ["Hormonal Rhythm"],
    domainPhrase: "hormonal and cycle rhythm experiences",
  },
  {
    nodeId: "cycle_disruption",
    label: "Cycle Disruption",
    left: "88.8%",
    top: "76.2%",
    linkedSections: ["hormonal", "daily_life"],
    preferredPatterns: ["Body Unpredictability", "Hormonal Rhythm"],
    domainPhrase: "cycle disruption and unpredictability",
  },
  {
    nodeId: "daily_life",
    label: "Daily Life",
    left: "50.6%",
    top: "88%",
    linkedSections: ["daily_life", "narrative"],
    preferredPatterns: ["Daily Function", "Life Reorganization"],
    domainPhrase: "daily life impact",
  },
  {
    nodeId: "care_access",
    label: "Care Access",
    left: "14.8%",
    top: "76.2%",
    linkedSections: ["care"],
    preferredPatterns: ["Care Experience"],
    domainPhrase: "care-related experiences",
  },
];

function patternIdFromName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function formatObservationList(observations: string[], locale?: string) {
  if (observations.length === 0) return "";
  if (observations.length === 1) return observations[0];
  const and = v43Text("_template", "listAnd", "and", locale);
  if (observations.length === 2) return `${observations[0]} ${and} ${observations[1]}`;
  return `${observations.slice(0, -1).join("; ")}; ${and} ${observations.at(-1)}`;
}

function observationsForHotspot(
  hotspot: ConstellationHotspotDefinition,
  allObservations: AtlasObservationRecord[],
) {
  return allObservations.filter((observation) => hotspot.linkedSections.includes(observation.section));
}

function observationsForPattern(
  patternName: string,
  observations: AtlasObservationRecord[],
  ontologyContext: ReturnType<typeof buildOntologyRoutingContext>,
) {
  const routings = routingsForPattern(ontologyContext, patternName, "primary");
  if (routings.length > 0) {
    const observationIds = new Set(routings.map((routing) => routing.observationId));
    return observations.filter((observation) => observationIds.has(observation.id));
  }
  return [];
}

function resolveDetectedPattern(
  hotspot: ConstellationHotspotDefinition,
  observedPatterns: AtlasObservedPattern[],
) {
  return (
    hotspot.preferredPatterns
      .map((patternName) => observedPatterns.find((pattern) => pattern.name === patternName))
      .find((pattern): pattern is AtlasObservedPattern => Boolean(pattern)) ?? null
  );
}

function resolvePatternTitle(
  hotspot: ConstellationHotspotDefinition,
  detectedPattern: AtlasObservedPattern | null,
) {
  return detectedPattern?.name ?? hotspot.preferredPatterns[0];
}

function computeConfidence(
  sectionObservations: AtlasObservationRecord[],
  patternObservations: AtlasObservationRecord[],
  detectedPattern: AtlasObservedPattern | null,
): ConstellationNodeConfidence {
  if (detectedPattern && patternObservations.length >= 2) return "strong";
  if (detectedPattern || patternObservations.length >= 2 || sectionObservations.length >= 3) return "emerging";
  return "light_baseline";
}

function buildWhatAtlasObserved(
  hotspot: ConstellationHotspotDefinition,
  sectionObservations: AtlasObservationRecord[],
  patternObservations: AtlasObservationRecord[],
  confidence: ConstellationNodeConfidence,
  locale?: string,
) {
  const t = (field: string, fallback: string) => v43Text("_template", field, fallback, locale);
  const domainPhrase = v43Text(hotspot.nodeId, "domainPhrase", hotspot.domainPhrase, locale);
  const displayItems = (patternObservations.length > 0 ? patternObservations : sectionObservations).map(
    (observation) => observation.displayText,
  );

  if (displayItems.length === 0) {
    return `${t("constellationNoObservationsLead", "In this first record, you did not share specific observations that center")} ${domainPhrase}. ${t("constellationLightBaselineOnly", "Atlas is noting this as a light baseline area only.")}`;
  }

  const listed = formatObservationList(displayItems.slice(0, 5), locale);

  if (confidence === "light_baseline") {
    return `${t("constellationLightBaselineLead", "Atlas noticed a light baseline of")} ${domainPhrase} ${t("constellationInRecordIncluding", "in this record, including")} ${listed}.`;
  }

  return `${t("constellationObservedLead", "Atlas noticed")} ${domainPhrase} ${t("constellationInRecordIncluding", "in this record, including")} ${listed}.`;
}

function buildWhyAtlasConnected(
  patternTitle: string,
  detectedPattern: AtlasObservedPattern | null,
  patternObservations: AtlasObservationRecord[],
  confidence: ConstellationNodeConfidence,
  locale?: string,
) {
  const t = (field: string, fallback: string) => v43Text("_template", field, fallback, locale);
  const metadata = PATTERN_METADATA[patternTitle];
  const patternId = getPatternDefinition(patternTitle)?.id ?? patternTitle;

  if (patternObservations.length === 0) {
    return t(
      "constellationOnlyLightBaseline",
      "Atlas has only a light baseline in this area so far. As you add more observations, it may become clearer why these experiences belong together.",
    );
  }

  const base =
    detectedPattern?.whyAtlasConnected ??
    (metadata?.whyConnected
      ? v43Text(patternId, "constellationWhyConnected", metadata.whyConnected, locale)
      : t(
          "constellationGenericWhyConnected",
          "Atlas grouped these observations because they may belong to the same lived pattern in this record.",
        ));

  if (confidence === "strong") {
    return `${base} ${t("constellationMultipleAnswersConverged", "In this record, multiple answers converged around the same thread. This is observational, not diagnostic.")}`;
  }

  return `${base} ${t("constellationObservationalNotDiagnostic", "This is observational, not diagnostic.")}`;
}

function buildWhatAtlasWillObserve(
  patternTitle: string,
  detectedPattern: AtlasObservedPattern | null,
  hotspot: ConstellationHotspotDefinition,
  locale?: string,
) {
  const patternId = getPatternDefinition(patternTitle)?.id ?? patternTitle;
  const metadataWatch = PATTERN_METADATA[patternTitle]?.watchOverTime;
  const domainPhrase = v43Text(hotspot.nodeId, "domainPhrase", hotspot.domainPhrase, locale);

  return (
    detectedPattern?.watchOverTime ??
    (metadataWatch
      ? v43Text(patternId, "constellationWatchOverTime", metadataWatch, locale)
      : `${v43Text("_template", "constellationFutureObservationsMayClarify", "Future observations may clarify how", locale)} ${domainPhrase} ${v43Text("_template", "constellationChangesStabilizesConnects", "changes, stabilizes, or connects with other areas of your record.", locale)}`)
  );
}

function buildAtlasNote(confidence: ConstellationNodeConfidence, locale?: string) {
  const t = (field: string, fallback: string) => v43Text("_template", field, fallback, locale);
  if (confidence === "strong") {
    return t(
      "constellationAtlasNoteStrong",
      "This is an early baseline from your first observation, not a diagnosis or fixed conclusion. The pattern may strengthen, change, merge with others, or become less central as more observations are added.",
    );
  }
  if (confidence === "emerging") {
    return t(
      "constellationAtlasNoteEmerging",
      "This is an early baseline from your first observation, not a diagnosis or fixed conclusion. Atlas sees emerging convergence here, but the pattern may still strengthen, change, merge, or fade as more observations are added.",
    );
  }
  return t(
    "constellationAtlasNoteLight",
    "This is an early baseline from your first observation, not a diagnosis or fixed conclusion. The evidence here is still light, and this pattern may strengthen, change, merge with others, or disappear as more observations are added.",
  );
}

function findRelatedPatterns(
  patternTitle: string,
  hotspot: ConstellationHotspotDefinition,
  observedPatterns: AtlasObservedPattern[],
  patternConnections: AtlasPatternConnection[],
  locale?: string,
) {
  const related = new Set<string>();

  for (const pattern of observedPatterns) {
    if (pattern.name === patternTitle) continue;
    if (hotspot.preferredPatterns.includes(pattern.name)) {
      related.add(participantLabelFor(pattern.name, locale));
    }
  }

  for (const connection of patternConnections) {
    if (connection.patternA === patternTitle) related.add(participantLabelFor(connection.patternB, locale));
    if (connection.patternB === patternTitle) related.add(participantLabelFor(connection.patternA, locale));
  }

  related.delete(participantLabelFor(patternTitle, locale));

  return [...related].slice(0, 3);
}

export function buildConstellationNodeContent(input: {
  hotspot: ConstellationHotspotDefinition;
  observations: AtlasObservationRecord[];
  observedPatterns: AtlasObservedPattern[];
  patternConnections: AtlasPatternConnection[];
  locale?: string;
}): ConstellationNodeContent {
  const locale = input.locale;
  const ontologyContext = buildOntologyRoutingContext(input.observations, locale);
  const sectionObservations = observationsForHotspot(input.hotspot, input.observations);
  const detectedPattern = resolveDetectedPattern(input.hotspot, input.observedPatterns);
  const patternTitle = resolvePatternTitle(input.hotspot, detectedPattern);
  const patternObservations = observationsForPattern(patternTitle, sectionObservations, ontologyContext);
  const confidence = computeConfidence(sectionObservations, patternObservations, detectedPattern);

  const supportingObservations = (patternObservations.length > 0 ? patternObservations : sectionObservations).map(
    (observation) => observation.displayText,
  );

  return {
    nodeId: input.hotspot.nodeId,
    patternId: patternIdFromName(patternTitle),
    patternTitle: participantLabelFor(patternTitle, locale),
    domainLabel: v43Text(input.hotspot.nodeId, "label", input.hotspot.label, locale),
    whatAtlasObserved: buildWhatAtlasObserved(input.hotspot, sectionObservations, patternObservations, confidence, locale),
    whyAtlasConnected: buildWhyAtlasConnected(patternTitle, detectedPattern, patternObservations, confidence, locale),
    whatAtlasWillObserve: buildWhatAtlasWillObserve(patternTitle, detectedPattern, input.hotspot, locale),
    atlasNote: buildAtlasNote(confidence, locale),
    relatedPatterns: findRelatedPatterns(patternTitle, input.hotspot, input.observedPatterns, input.patternConnections, locale),
    confidenceLevel: confidence,
    supportingObservations,
  };
}

export function buildAllConstellationNodes(
  observations: AtlasObservationRecord[],
  observedPatterns: AtlasObservedPattern[],
  patternConnections: AtlasPatternConnection[],
  locale?: string,
): ConstellationNodeContent[] {
  return CONSTELLATION_HOTSPOTS.map((hotspot) =>
    buildConstellationNodeContent({ hotspot, observations, observedPatterns, patternConnections, locale }),
  );
}
