import type { FlagDefinition, FlagVariant } from "./types";

export interface CommonFlagOptions {
  schedule?: { startAt?: string; endAt?: string };
  description?: string;
  owners?: string[];
  dependsOn?: string[];
}

export interface DefineBooleanFlagOptions extends CommonFlagOptions {
  key: string;
  defaultValue: boolean;
}

export interface DefineExperimentOptions<T> extends CommonFlagOptions {
  key: string;
  /** Fallback used by evaluate() when no bucketing key resolves. */
  defaultValue: T;
  variants: FlagVariant<T>[];
}

export interface DefineDynamicConfigOptions<T> extends CommonFlagOptions {
  key: string;
  defaultValue: T;
}

/**
 * Release flag: boolean, closed fail-safe, no special traits.
 */
export function defineReleaseFlag(options: DefineBooleanFlagOptions): FlagDefinition<boolean> {
  const { key, defaultValue, ...common } = options;
  return {
    key,
    defaultValue,
    kind: "release",
    valueType: "boolean",
    failureMode: "closed",
    sticky: false,
    emitsExposure: false,
    ...common,
  };
}

/**
 * Kill switch: boolean, closed fail-safe (flip off is always safe).
 * Intended to be flipped fast and manually — PLAN.md §3.3.
 */
export function defineKillSwitch(options: DefineBooleanFlagOptions): FlagDefinition<boolean> {
  const { key, defaultValue, ...common } = options;
  return {
    key,
    defaultValue,
    kind: "killSwitch",
    valueType: "boolean",
    failureMode: "closed",
    sticky: false,
    emitsExposure: false,
    ...common,
  };
}

/**
 * A/B test: variant-shaped, sticky (same key always resolves the same way),
 * emits exposure events for analytics.
 */
export function defineExperiment<T>(options: DefineExperimentOptions<T>): FlagDefinition<T> {
  const { key, defaultValue, variants, ...common } = options;
  return {
    key,
    defaultValue,
    variants,
    kind: "experiment",
    valueType: "variant",
    failureMode: "closed",
    sticky: true,
    emitsExposure: true,
    ...common,
  };
}

/**
 * Safer Refactor (migration) flag: boolean-only in v1 — PLAN.md §3.2 allows
 * "boolean or value," but a value-shaped variant is fully achievable by
 * hand-authoring a FlagDefinition with kind:"migration" directly. Sticky so
 * a user doesn't flip between old/new mid-session. Pair with runShadow()/
 * runShadowAsync() (shadow.ts) for the comparison-hook half of this kind —
 * that utility is deliberately not coupled to this factory or FlagDefinition.
 */
export function defineMigrationFlag(options: DefineBooleanFlagOptions): FlagDefinition<boolean> {
  const { key, defaultValue, ...common } = options;
  return {
    key,
    defaultValue,
    kind: "migration",
    valueType: "boolean",
    failureMode: "closed",
    sticky: true,
    emitsExposure: false,
    ...common,
  };
}

/**
 * Progressive deploy (ring/wave rollout): boolean, sticky. "Rings" are a
 * rollout convention realized via FlagRemoteState.rolloutPercentage over
 * time — not a structural feature of the engine or this factory.
 */
export function defineProgressiveDeploy(options: DefineBooleanFlagOptions): FlagDefinition<boolean> {
  const { key, defaultValue, ...common } = options;
  return {
    key,
    defaultValue,
    kind: "progressiveDeploy",
    valueType: "boolean",
    failureMode: "closed",
    sticky: true,
    emitsExposure: false,
    ...common,
  };
}

/**
 * Entitlement flag: boolean, targeting-rules-driven (plan tier/org/role via
 * remote-state targetingRules) — no random rollout by convention.
 */
export function defineEntitlementFlag(options: DefineBooleanFlagOptions): FlagDefinition<boolean> {
  const { key, defaultValue, ...common } = options;
  return {
    key,
    defaultValue,
    kind: "entitlement",
    valueType: "boolean",
    failureMode: "closed",
    sticky: false,
    emitsExposure: false,
    ...common,
  };
}

/**
 * Ops / circuit breaker: boolean, closed fail-safe. Intended to be flipped
 * programmatically (e.g. by a monitoring system), not manually via a UI.
 */
export function defineCircuitBreaker(options: DefineBooleanFlagOptions): FlagDefinition<boolean> {
  const { key, defaultValue, ...common } = options;
  return {
    key,
    defaultValue,
    kind: "circuitBreaker",
    valueType: "boolean",
    failureMode: "closed",
    sticky: false,
    emitsExposure: false,
    ...common,
  };
}

/**
 * Dynamic config: arbitrary typed value, targeting-rules-driven — no
 * boolean semantics at all.
 */
export function defineDynamicConfig<T>(options: DefineDynamicConfigOptions<T>): FlagDefinition<T> {
  const { key, defaultValue, ...common } = options;
  return {
    key,
    defaultValue,
    kind: "dynamicConfig",
    valueType: "value",
    failureMode: "closed",
    sticky: false,
    emitsExposure: false,
    ...common,
  };
}
