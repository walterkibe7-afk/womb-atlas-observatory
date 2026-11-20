// Deterministic signal extraction (sheet 05_Signal_Registry, encoded as rules).
import { collectEvidence, evaluate } from "./conditions";
import type { AnswerMap, ComputedSignal, SignalRuleDef } from "./types";

export function computeSignals(answers: AnswerMap, rules: SignalRuleDef[]): ComputedSignal[] {
  const ctx = { answers, signals: [] as string[] };
  const fired: ComputedSignal[] = [];
  for (const rule of rules) {
    if (evaluate(rule.condition, ctx)) {
      fired.push({
        signalId: rule.signalId,
        name: rule.name,
        domain: rule.domain,
        severity: rule.severity,
        evidence: collectEvidence(rule.condition, answers),
      });
    }
  }
  return fired;
}

export function firedSignalIds(signals: ComputedSignal[]): string[] {
  return signals.map((s) => s.signalId);
}
