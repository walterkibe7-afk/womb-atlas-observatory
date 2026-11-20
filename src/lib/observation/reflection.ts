// Burden scoring + reflection-template selection (sheets 03 routing rows 38-40
// and 06_Reflection_Rules). Deterministic; reflection copy comes from the DB
// rule rows, not inline templates.
import { evaluate } from "./conditions";
import type { Burden, ComputedSignal, ReflectionRuleDef } from "./types";

const SEVERITY_WEIGHT: Record<string, number> = { high: 3, moderate: 1, low: 0.5 };

export function burdenScore(signals: ComputedSignal[]): number {
  return signals.reduce((sum, s) => sum + (SEVERITY_WEIGHT[s.severity] ?? 0), 0);
}

// Per sheet 03: score <= 1 -> minimal (S77A); 2-5 -> standard (S77); >= 6 -> high (S77B).
export function computeBurden(signals: ComputedSignal[]): Burden {
  const score = burdenScore(signals);
  if (score <= 1) return "Low";
  if (score >= 6) return "High";
  return "Moderate";
}

const SCREEN_RANK: Record<string, number> = { S77A: 0, S77: 1, S77B: 2 };

export interface ReflectionResult {
  targetScreen: string; // S77 | S77A | S77B
  burden: Burden;
  reflectionType: string;
  matchedRuleIds: string[];
  copy: string[]; // ordered reflection paragraphs
}

export function selectReflection(
  signals: ComputedSignal[],
  rules: ReflectionRuleDef[],
): ReflectionResult {
  const burden = computeBurden(signals);
  const ctx = { answers: {}, signals: signals.map((s) => s.signalId), burden };

  const matched = rules
    .filter((r) => evaluate(r.condition, ctx))
    .sort((a, b) => a.priority - b.priority);

  // Target screen = the most "serious" target among matched rules, falling back
  // to the burden-derived screen when nothing matched.
  let targetScreen = burden === "High" ? "S77B" : burden === "Low" ? "S77A" : "S77";
  for (const r of matched) {
    if ((SCREEN_RANK[r.targetScreen] ?? 1) > (SCREEN_RANK[targetScreen] ?? 1)) {
      targetScreen = r.targetScreen;
    }
  }

  return {
    targetScreen,
    burden,
    reflectionType: matched[0]?.reflectionType ?? (burden === "Low" ? "Minimal" : "General"),
    matchedRuleIds: matched.map((r) => r.ruleId),
    copy: matched.map((r) => r.templateCopy),
  };
}
