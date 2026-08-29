import type { EvaluatedFlag } from "@feature-flags/core";

export function evaluatedFlagsEqual<T>(a: EvaluatedFlag<T>, b: EvaluatedFlag<T>): boolean {
  return (
    a.key === b.key &&
    Object.is(a.value, b.value) &&
    a.variantKey === b.variantKey &&
    a.reason === b.reason &&
    a.ruleMatched === b.ruleMatched &&
    a.stale === b.stale
  );
}
