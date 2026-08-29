export type {
  EvaluatedFlag,
  EvaluationContext,
  EvaluationReason,
  FailureMode,
  FlagDefinition,
  FlagKind,
  FlagProvider,
  FlagRemoteState,
  FlagVariant,
  TargetingRule,
} from "./types";

export { evaluate } from "./engine";
export { resolveBucketingKey, computeBucket, isInRollout } from "./bucketing";
export { matchRule, evaluateRules } from "./targeting";
export { mergeDefinitionWithRemoteState } from "./merge";
export type { ResolvedFlagConfig } from "./merge";
export { LocalProvider } from "./providers/local";
export { fnv1a } from "./hash";
export { FlagsClient } from "./client";
export type {
  ClientUpdateListener,
  FlagOverride,
  FlagStateCache,
  FlagStateEntry,
  FlagsClientOptions,
  OnEvaluateHandler,
  RefreshResult,
  Unsubscribe,
} from "./client";
export { TtlFlagStateCache, wireAutoRevalidation } from "./cache";
export type { CacheStaleness, TtlFlagStateCacheOptions } from "./cache";
export { HttpPollingProvider } from "./providers/http-polling";
export type { HttpPollingProviderOptions } from "./providers/http-polling";
export { SseProvider } from "./providers/sse";
export type { SseProviderOptions } from "./providers/sse";
export {
  defineReleaseFlag,
  defineKillSwitch,
  defineExperiment,
  defineMigrationFlag,
  defineProgressiveDeploy,
  defineEntitlementFlag,
  defineCircuitBreaker,
  defineDynamicConfig,
} from "./kinds";
export type {
  CommonFlagOptions,
  DefineBooleanFlagOptions,
  DefineExperimentOptions,
  DefineDynamicConfigOptions,
} from "./kinds";
export { runShadow, runShadowAsync, deepEqual } from "./shadow";
export type { ShadowResult, ShadowResultHandler } from "./shadow";
