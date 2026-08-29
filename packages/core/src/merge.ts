import type { FlagDefinition, FlagRemoteState, FlagVariant, TargetingRule } from "./types";

/**
 * Field-by-field merge of code-defined schema + remote live state (PLAN.md
 * §4.4). Any field missing from `remoteState` (or no remote state at all —
 * e.g. provider unreachable) falls back to the code-defined default. This
 * fallback *is* the kill-switch fail-safe path; there is no separate
 * error-handling branch.
 */
export interface ResolvedFlagConfig<T> {
  key: string;
  defaultValue: T;
  failureMode: FlagDefinition<T>["failureMode"];
  sticky: boolean;
  emitsExposure: boolean;
  dependsOn?: string[];
  schedule?: { startAt?: string; endAt?: string };
  enabled?: boolean;
  rolloutPercentage?: number;
  bucketingSeed?: string;
  targetingRules: TargetingRule[];
  variants?: FlagVariant<T>[];
  valueOverride?: unknown;
}

export function mergeDefinitionWithRemoteState<T>(
  definition: FlagDefinition<T>,
  remoteState?: FlagRemoteState,
): ResolvedFlagConfig<T> {
  const variants = definition.variants?.map((variant) => {
    const override = remoteState?.variantOverrides?.find((o) => o.key === variant.key);
    return override ? { ...variant, weight: override.weight } : variant;
  });

  return {
    key: definition.key,
    defaultValue: definition.defaultValue,
    failureMode: definition.failureMode,
    sticky: definition.sticky,
    emitsExposure: definition.emitsExposure,
    dependsOn: definition.dependsOn,
    schedule: definition.schedule,
    enabled: remoteState?.enabled,
    rolloutPercentage: remoteState?.rolloutPercentage,
    bucketingSeed: remoteState?.bucketingSeed,
    targetingRules: remoteState?.targetingRules ?? [],
    variants,
    valueOverride: remoteState?.valueOverride,
  };
}
