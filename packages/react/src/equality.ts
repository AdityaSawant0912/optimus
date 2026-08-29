import type { EvaluationContext } from "@useoptimus/core";

function attributesEqual(
  a: EvaluationContext["attributes"],
  b: EvaluationContext["attributes"],
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

/**
 * `undefined` and `{}` are treated as equal (every EvaluationContext field
 * is optional) so an inline `context={{}}` literal doesn't spuriously
 * count as a context change on every render.
 */
export function evaluationContextsEqual(
  a: EvaluationContext | undefined,
  b: EvaluationContext | undefined,
): boolean {
  const left = a ?? {};
  const right = b ?? {};

  return (
    left.bucketingKey === right.bucketingKey &&
    left.userId === right.userId &&
    left.deviceId === right.deviceId &&
    left.sessionId === right.sessionId &&
    left.anonymousId === right.anonymousId &&
    left.environment === right.environment &&
    attributesEqual(left.attributes, right.attributes)
  );
}
