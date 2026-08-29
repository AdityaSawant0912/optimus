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
