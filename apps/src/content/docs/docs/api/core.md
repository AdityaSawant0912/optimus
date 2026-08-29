---
title: Core API Reference
description: FlagDefinition, EvaluationContext, FlagProvider, and EvaluatedFlag types.
sidebar:
  order: 1
---

Hand-written reference for everything `@feature-flags/core` exports today
(`packages/core/src/index.ts`). Generating this from TSDoc via TypeDoc is
planned — see the docs-site README — but not wired up yet.

## Types

### `FlagDefinition<T>`

```ts
interface FlagDefinition<T = boolean> {
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
```

The code-defined schema half of a flag. See
[Flag Taxonomy](/docs/concepts/flag-taxonomy/) for what each field does.

### `FlagKind`

```ts
type FlagKind =
  | "release" | "killSwitch" | "experiment" | "migration"
  | "progressiveDeploy" | "entitlement" | "circuitBreaker"
  | "dynamicConfig" | "custom";
```

### `FailureMode`

```ts
type FailureMode = "closed" | "open" | "lastKnown";
```

### `FlagVariant<T>`

```ts
interface FlagVariant<T> {
  key: string;
  value: T;
  weight: number;
}
```

### `FlagRemoteState`

```ts
interface FlagRemoteState {
  key: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  bucketingSeed?: string;
  targetingRules?: TargetingRule[];
  variantOverrides?: { key: string; weight: number }[];
  valueOverride?: unknown;
  updatedAt: string;
}
```

The live/remote half of a flag. Any field left unset falls back to the
`FlagDefinition`'s code-defined default — this fallback is the kill-switch
fail-safe path.

### `EvaluationContext`

```ts
interface EvaluationContext {
  bucketingKey?: string;
  userId?: string;
  deviceId?: string;
  sessionId?: string;
  anonymousId?: string;
  attributes?: Record<string, string | number | boolean>;
  environment?: string;
}
```

See [Bucketing & Salting](/docs/concepts/bucketing/) for how `bucketingKey`
is resolved.

### `EvaluatedFlag<T>`

```ts
interface EvaluatedFlag<T = boolean> {
  key: string;
  value: T;
  variantKey?: string;
  reason: EvaluationReason;
  ruleMatched?: string;
  stale: boolean;
}
```

### `EvaluationReason`

```ts
type EvaluationReason =
  | "default" | "targetingMatch" | "rollout"
  | "override" | "fallbackError" | "dependencyNotMet";
```

`fallbackError` is part of the type but not currently returned by
`evaluate()` — no code path in `engine.ts` produces it yet.

### `TargetingRule`

```ts
type TargetingRule =
  | { type: "attributeEquals"; attribute: string; value: string | number | boolean }
  | { type: "attributeIn"; attribute: string; values: (string | number)[] }
  | { type: "percentageRollout"; percentage: number; bucketingSeed?: string }
  | { type: "semverRange"; attribute: string; range: string }
  | { type: "dateRange"; startAt?: string; endAt?: string }
  | { type: "and"; rules: TargetingRule[] }
  | { type: "or"; rules: TargetingRule[] };
```

### `FlagProvider`

```ts
interface FlagProvider {
  name: string;
  init(): Promise<void>;
  getRemoteState(keys?: string[]): Promise<FlagRemoteState[]>;
  subscribe?(onUpdate: (state: FlagRemoteState[]) => void): () => void;
}
```

`subscribe` is optional — implement it for push-based providers (SSE/WS);
polling providers can omit it. No HTTP-polling or SSE provider ships yet,
only `LocalProvider`.

### `ResolvedFlagConfig<T>`

```ts
interface ResolvedFlagConfig<T> {
  key: string;
  defaultValue: T;
  failureMode: FailureMode;
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
```

The result of merging a `FlagDefinition` with its `FlagRemoteState` — the
return type of `mergeDefinitionWithRemoteState`.

## Functions

### `evaluate(definition, remoteState, context, dependencies?)`

```ts
function evaluate<T>(
  definition: FlagDefinition<T>,
  remoteState: FlagRemoteState | undefined,
  context: EvaluationContext,
  dependencies?: Record<string, EvaluatedFlag>,
): EvaluatedFlag<T>
```

Pure and deterministic: identical inputs always produce an identical
`EvaluatedFlag`, which is what makes SSR snapshot/hydrate parity possible.
`dependencies` supports only the `dependsOn` trait's simple truthy-parent
check — a parent flag resolving to a specific variant is not supported.

### `resolveBucketingKey(context)`

```ts
function resolveBucketingKey(context: EvaluationContext): string | undefined
```

Applies the default identity resolution chain. See
[Bucketing & Salting](/docs/concepts/bucketing/).

### `computeBucket(bucketingKey, flagKey, seed?)`

```ts
function computeBucket(bucketingKey: string, flagKey: string, seed?: string): number
```

Returns a bucket value in `[0, 10000)`.

### `isInRollout(bucketValue, percentage)`

```ts
function isInRollout(bucketValue: number, percentage: number): boolean
```

`percentage` is 0–100.

### `matchRule(rule, context, flagKey)`

```ts
function matchRule(rule: TargetingRule, context: EvaluationContext, flagKey: string): boolean
```

Evaluates a single `TargetingRule` against a context.

### `evaluateRules(rules, context, flagKey)`

```ts
function evaluateRules(
  rules: TargetingRule[],
  context: EvaluationContext,
  flagKey: string,
): { matched: boolean; rule?: TargetingRule }
```

First-match-wins over the rule list.

### `mergeDefinitionWithRemoteState(definition, remoteState?)`

```ts
function mergeDefinitionWithRemoteState<T>(
  definition: FlagDefinition<T>,
  remoteState?: FlagRemoteState,
): ResolvedFlagConfig<T>
```

Field-by-field merge of code schema and remote state. Used internally by
`evaluate()`; exported for testing merge behavior in isolation.

### `fnv1a(input)`

```ts
function fnv1a(input: string): number
```

FNV-1a 32-bit hash. Not cryptographic — used purely for bucketing
distribution. `computeBucket` runs this through an additional avalanche step
before reducing it; see [Bucketing & Salting](/docs/concepts/bucketing/) for
why.

## Classes

### `LocalProvider`

```ts
class LocalProvider implements FlagProvider {
  name: "local";
  constructor(state: FlagRemoteState[]);
  init(): Promise<void>;
  getRemoteState(keys?: string[]): Promise<FlagRemoteState[]>;
}
```

Static/in-memory provider, no network calls. Useful for tests and local
development. Does not implement `subscribe`.
