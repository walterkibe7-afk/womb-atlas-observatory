// Validates a reflection against the AIKB governance rules. Ported/adapted from
// participant-app governance-service.ts to operate on the lean AtlasReflection.
// Any "block"-severity rule that trips marks the reflection as failing governance.
import type { AikbBundle } from "@/lib/observation/aikb/types";
import type { AtlasReflection } from "./types";

// Bare "you have " is intentionally excluded — it matches benign observational
// prose ("you have been noticing…") and produced false governance failures. The
// LLM output guard (openai-reflection.ts) blocks the diagnostic *constructions*.
const BLOCKED_TERMS = [
  "diagnosis",
  "diagnose",
  "disease probability",
  "likely condition",
];

export function validateGovernance(
  reflection: AtlasReflection,
  aikb: AikbBundle,
): { passed: boolean; violations: string[] } {
  const violations: string[] = [];
  const corpus = JSON.stringify(reflection).toLowerCase();

  for (const rule of aikb.governance.rules) {
    if (rule.severity !== "block") continue;
    // GOV-001 (never diagnose) / GOV-002 (observational language) are enforced by
    // scanning for clinically-directive language.
    if (rule.id === "GOV-001" || rule.id === "GOV-002") {
      for (const term of BLOCKED_TERMS) {
        if (corpus.includes(term)) {
          violations.push(`${rule.id}: blocked term "${term.trim()}" detected`);
        }
      }
    }
  }

  return { passed: violations.length === 0, violations };
}
