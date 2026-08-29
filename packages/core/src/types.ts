// ---- Targeting ----

export type TargetingRule =
  | { type: "attributeEquals"; attribute: string; value: string | number | boolean }
  | { type: "attributeIn"; attribute: string; values: (string | number)[] }
  | { type: "percentageRollout"; percentage: number; bucketingSeed?: string }
  | { type: "semverRange"; attribute: string; range: string }
  | { type: "dateRange"; startAt?: string; endAt?: string }
  | { type: "and"; rules: TargetingRule[] }
  | { type: "or"; rules: TargetingRule[] };

// ---- Flag definition (code-defined schema) ----

export type FlagKind =
  | "release"
  | "killSwitch"
  | "experiment"
  | "migration"
  | "progressiveDeploy"
  | "entitlement"
  | "circuitBreaker"
  | "dynamicConfig"
  | "custom";

export type FailureMode = "closed" | "open" | "lastKnown";

export interface FlagVariant<T> {
  key: string;
  value: T;
  weight: number;
}

export interface FlagDefinition<T = boolean> {
  key: string;
  kind: FlagKind;
  valueType: "boolean" | "variant" | "value";
  defaultValue: T;
  variants?: FlagVariant<T>[];
  failureMode: FailureMode;
  sticky: boolean;
  emitsExposure: boolean;
  dependsOn?: string[];
  schedule?: { startAt?: string; endAt?: string };
  description?: string;
  owners?: string[];
}

// ---- Live/remote state (overrides parts of the definition) ----

export interface FlagRemoteState {
  key: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  bucketingSeed?: string;
  targetingRules?: TargetingRule[];
  variantOverrides?: { key: string; weight: number }[];
  valueOverride?: unknown;
  updatedAt: string;
}

// ---- Evaluation context ----

/**
 * Identity aliasing (anonymous -> identified re-bucketing) is out of scope for v1.
 * If `bucketingKey` (or the resolved chain) changes between calls for what is
 * conceptually "the same user" (e.g. pre- and post-login), bucket assignment
 * may change. See PLAN.md §5.
 */
export interface EvaluationContext {
  bucketingKey?: string;
  userId?: string;
  deviceId?: string;
  sessionId?: string;
  anonymousId?: string;
  attributes?: Record<string, string | number | boolean>;
  environment?: string;
}

// ---- Result returned to consumers ----

export type EvaluationReason =
  | "default"
  | "targetingMatch"
  | "rollout"
  | "override"
  | "fallbackError"
  | "dependencyNotMet";

export interface EvaluatedFlag<T = boolean> {
  key: string;
  value: T;
  variantKey?: string;
  reason: EvaluationReason;
  ruleMatched?: string;
  stale: boolean;
}

// ---- Provider interface ----

export interface FlagProvider {
  name: string;
  init(): Promise<void>;
  getRemoteState(keys?: string[]): Promise<FlagRemoteState[]>;
  subscribe?(onUpdate: (state: FlagRemoteState[]) => void): () => void;
}
