// Safe, isomorphic interpreter for the condition DSL. No eval, no dynamic code —
// only the operators enumerated here. Used by routing, signals, and reflection.
import type { AnswerValue, Condition, EvalContext } from "./types";

function isPresent(v: AnswerValue | undefined): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "boolean") return v === true;
  return true;
}

function asArray(v: AnswerValue | undefined): string[] {
  if (Array.isArray(v)) return v as string[];
  if (v == null) return [];
  return [String(v)];
}

export function evaluate(condition: Condition | null | undefined, ctx: EvalContext): boolean {
  if (condition == null) return true; // null condition = default/fallback (always matches)

  if ("all" in condition) return condition.all.every((c) => evaluate(c, ctx));
  if ("any" in condition) return condition.any.some((c) => evaluate(c, ctx));
  if ("not" in condition) return !evaluate(condition.not, ctx);

  if ("signal" in condition) {
    const fired = ctx.signals.includes(condition.signal);
    return condition.op === "absent" ? !fired : fired;
  }

  if ("burden" in condition) {
    return ctx.burden === condition.burden;
  }

  // field leaf
  const answer = ctx.answers[condition.field];
  const value = condition.value;

  switch (condition.op) {
    case "eq":
      return answer === value;
    case "neq":
      return answer !== value;
    case "in":
      return Array.isArray(value) && !Array.isArray(answer) && answer != null
        ? (value as unknown[]).includes(answer)
        : false;
    case "nin":
      return Array.isArray(value) ? !(value as unknown[]).includes(answer as unknown) : false;
    case "contains_any": {
      const a = asArray(answer);
      const v = (value as string[]) || [];
      return a.some((x) => v.includes(x));
    }
    case "any_except": {
      // true if the answer holds at least one value not in the excluded list
      const a = asArray(answer);
      const exc = (value as string[]) || [];
      return a.length > 0 && a.some((x) => !exc.includes(x));
    }
    case "count_gte": {
      const exclude = condition.exclude || [];
      const a = asArray(answer).filter((x) => !exclude.includes(x));
      return a.length >= Number(value);
    }
    case "present":
      return isPresent(answer);
    case "isTrue":
      return answer === true;
    default:
      return false;
  }
}

// Collect the field ids a condition references, with their current answers —
// used to attach human-readable evidence to a fired signal.
export function collectEvidence(
  condition: Condition,
  answers: Record<string, AnswerValue>,
  out: Record<string, AnswerValue> = {},
): Record<string, AnswerValue> {
  if ("all" in condition) condition.all.forEach((c) => collectEvidence(c, answers, out));
  else if ("any" in condition) condition.any.forEach((c) => collectEvidence(c, answers, out));
  else if ("not" in condition) collectEvidence(condition.not, answers, out);
  else if ("field" in condition) out[condition.field] = answers[condition.field] ?? null;
  return out;
}
