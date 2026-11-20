// Assembles the AIKB bundle from the committed registry JSON (src/content/aikb/).
// Uses static JSON imports (bundled) so it works uniformly in dev, build, and
// serverless — no runtime fs access or cwd assumptions.
import observationsJson from "@/content/aikb/observations.json";
import signalsJson from "@/content/aikb/signals.json";
import patternsJson from "@/content/aikb/patterns.json";
import reflectionJson from "@/content/aikb/reflection.json";
import knowledgeGraphJson from "@/content/aikb/knowledge_graph.json";
import indicesJson from "@/content/aikb/indices.json";
import governanceJson from "@/content/aikb/governance.json";

import type { AikbBundle } from "./types";

let cachedBundle: AikbBundle | null = null;

function assembleBundle(): AikbBundle {
  const observations = observationsJson as {
    version: string;
    generatedAt: string;
    fields: AikbBundle["observations"]["fields"];
  };

  return {
    version: observations.version,
    generatedAt: observations.generatedAt,
    observations: { fields: observations.fields },
    signals: signalsJson as unknown as AikbBundle["signals"],
    patterns: patternsJson as unknown as AikbBundle["patterns"],
    reflection: reflectionJson as unknown as AikbBundle["reflection"],
    knowledgeGraph: knowledgeGraphJson as unknown as AikbBundle["knowledgeGraph"],
    indices: indicesJson as unknown as AikbBundle["indices"],
    governance: governanceJson as unknown as AikbBundle["governance"],
  };
}

/** Synchronous accessor (the registry is bundled, so no IO is needed). */
export function getAikbBundle(): AikbBundle {
  if (!cachedBundle) cachedBundle = assembleBundle();
  return cachedBundle;
}

/** Async accessor kept for parity with the source-of-truth pipeline signature. */
export async function loadAikbBundle(): Promise<AikbBundle> {
  return getAikbBundle();
}

export function clearAikbCache() {
  cachedBundle = null;
}
