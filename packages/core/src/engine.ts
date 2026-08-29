import { computeBucket, resolveBucketingKey } from "./bucketing";
import { isInRollout } from "./bucketing";
import { evaluateRules } from "./targeting";
import { mergeDefinitionWithRemoteState } from "./merge";
import type { EvaluatedFlag, EvaluationContext, FlagDefinition, FlagRemoteState, FlagVariant } from "./types";

function withinSchedule(schedule: { startAt?: string; endAt?: string }): boolean {
  const now = Date.now();
  if (schedule.startAt && now < Date.parse(schedule.startAt)) return false;
  if (schedule.endAt && now > Date.parse(schedule.endAt)) return false;
  return true;
}

function pickVariant<T>(variants: FlagVariant<T>[], bucket: number): FlagVariant<T> {
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += (variant.weight / totalWeight) * 10000;
    if (bucket < cumulative) return variant;
  }
  // rounding fallback: last variant absorbs the remainder
  return variants[variants.length - 1] as FlagVariant<T>;
}

function ok<T>(key: string, value: T, reason: EvaluatedFlag<T>["reason"], variantKey?: string): EvaluatedFlag<T> {
  return { key, value, reason, variantKey, stale: false };
}

/**
 * Pure, deterministic: same (definition, remoteState, context, dependencies)
 * always produces the same EvaluatedFlag — required for SSR snapshot/hydrate
 * parity (PLAN.md §4.3). `dependencies` supports the `dependsOn` trait's
 * simple truthy-parent check only (PLAN.md §10 defers richer semantics).
 */
export function evaluate<T>(
  definition: FlagDefinition<T>,
  remoteState: FlagRemoteState | undefined,
  context: EvaluationContext,
  dependencies: Record<string, EvaluatedFlag> = {},
): EvaluatedFlag<T> {
  const resolved = mergeDefinitionWithRemoteState(definition, remoteState);

  for (const parentKey of resolved.dependsOn ?? []) {
    const parent = dependencies[parentKey];
    if (!parent || !parent.value) {
      return ok(definition.key, definition.defaultValue, "dependencyNotMet");
    }
  }

  if (resolved.schedule && !withinSchedule(resolved.schedule)) {
    return ok(definition.key, definition.defaultValue, "default");
  }

  if (resolved.enabled === false) {
    return ok(definition.key, definition.defaultValue, "override");
  }

  const bucketingKey = resolveBucketingKey(context);

  switch (definition.valueType) {
    case "boolean": {
      if (resolved.targetingRules.length > 0) {
        const { matched, rule } = evaluateRules(resolved.targetingRules, context, definition.key);
        if (matched && rule) {
          return ok(
            definition.key,
            true as T,
            rule.type === "percentageRollout" ? "rollout" : "targetingMatch",
          );
        }
      }
      if (resolved.rolloutPercentage !== undefined && bucketingKey !== undefined) {
        const bucket = computeBucket(bucketingKey, definition.key, resolved.bucketingSeed);
        const inRollout = isInRollout(bucket, resolved.rolloutPercentage);
        return ok(definition.key, inRollout as T, inRollout ? "rollout" : "default");
      }
      if (resolved.enabled === true) {
        return ok(definition.key, true as T, "override");
      }
      return ok(definition.key, definition.defaultValue, "default");
    }

    case "variant": {
      if (resolved.targetingRules.length > 0) {
        const { matched } = evaluateRules(resolved.targetingRules, context, definition.key);
        if (!matched) return ok(definition.key, definition.defaultValue, "default");
      }
      const variants = resolved.variants ?? [];
      if (bucketingKey === undefined || variants.length === 0) {
        return ok(definition.key, definition.defaultValue, "default");
      }
      const bucket = computeBucket(bucketingKey, definition.key, resolved.bucketingSeed);
      const chosen = pickVariant(variants, bucket);
      return ok(definition.key, chosen.value, "rollout", chosen.key);
    }

    case "value": {
      if (resolved.targetingRules.length > 0) {
        const { matched, rule } = evaluateRules(resolved.targetingRules, context, definition.key);
        if (matched && rule) {
          const value = resolved.valueOverride !== undefined ? (resolved.valueOverride as T) : definition.defaultValue;
          return ok(definition.key, value, rule.type === "percentageRollout" ? "rollout" : "targetingMatch");
        }
        return ok(definition.key, definition.defaultValue, "default");
      }
      if (resolved.valueOverride !== undefined) {
        return ok(definition.key, resolved.valueOverride as T, "override");
      }
      return ok(definition.key, definition.defaultValue, "default");
    }
  }
}
