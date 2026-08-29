import type { EvaluationContext } from "@optimus/core";
import { useFlag } from "./useFlag";

/**
 * Returns undefined — never throws, never casts .value to a string — when
 * the flag has no variantKey (e.g. it fell through to defaultValue with no
 * bucketing key resolvable). That's a normal, non-buggy state; fabricating
 * a string would hide the real "no variant assigned" signal.
 */
export function useVariant(key: string, context?: EvaluationContext): string | undefined {
  return useFlag<unknown>(key, context).variantKey;
}
