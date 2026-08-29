---
title: Core API Reference
description: FlagDefinition, EvaluationContext, FlagProvider, and EvaluatedFlag types.
sidebar:
  order: 1
---

Hand-written reference for everything `@optimus/core` exports today
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

`fallbackError` is never produced by the pure `evaluate()` function itself
— it's returned by `FlagsClient.evaluate()`/`evaluateAll()` when a
`'closed'`-failureMode flag falls back after a provider fetch failure. See
[`FlagsClient`](#flagsclient) below and
[Flag Taxonomy](/docs/concepts/flag-taxonomy/#traits).

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
polling providers can omit it.

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

### `HttpPollingProvider`

```ts
interface HttpPollingProviderOptions {
  url: string;
  intervalMs?: number; // steady-state poll interval, default 30_000
  fetchImpl?: FetchLike;
  headers?: Record<string, string>;
}

class HttpPollingProvider implements FlagProvider {
  name: "http-polling";
  constructor(options: HttpPollingProviderOptions);
}
```

Polls `url` on `intervalMs`, backing off on failure with Equal Jitter
exponential backoff (50%–100% of the doubling delay, capped at 5 minutes) so
a retry never degenerates to a near-immediate hammering on an unlucky
jitter roll.

### `SseProvider`

```ts
interface SseProviderOptions {
  url: string;
  eventSourceFactory?: () => EventSourceLike;
}

class SseProvider implements FlagProvider {
  name: "sse";
  constructor(options: SseProviderOptions);
}
```

`getRemoteState()` returns the last-known **pushed** state (`[]` before the
first message) rather than performing a network fetch. No self-implemented
reconnect — both the browser's native `EventSource` and the `eventsource`
npm package already auto-reconnect per the SSE spec.

## `FlagsClient`

Orchestration layer around the pure `evaluate()` engine: owns a flag
registry, a `FlagProvider`, cached remote state, `dependsOn` resolution
across multiple flags, `failureMode` semantics, and exposure events. Use
this instead of calling `evaluate()` directly for anything beyond a single
one-off evaluation.

```ts
interface FlagsClientOptions {
  definitions: FlagDefinition<unknown>[]; // immutable for the client's lifetime
  provider: FlagProvider;
  context?: EvaluationContext;
  cache?: FlagStateCache; // defaults to an in-memory Map; see TtlFlagStateCache below
  onEvaluate?: OnEvaluateHandler;
}

class FlagsClient {
  constructor(options: FlagsClientOptions);
  init(): Promise<void>;
  refresh(keys?: string[]): Promise<RefreshResult>;
  setContext(context: EvaluationContext): void;
  getContext(): EvaluationContext;
  evaluate<T = boolean>(key: string, context?: EvaluationContext): EvaluatedFlag<T>;
  evaluateAll(context?: EvaluationContext): Record<string, EvaluatedFlag>;
  onEvaluate(handler: OnEvaluateHandler): Unsubscribe;
  subscribe(listener: ClientUpdateListener): Unsubscribe;
  setOverrides(overrides: Record<string, FlagOverride>): void;
  clearOverrides(keys?: string[]): void;
  dispose(): void;
}
```

`evaluate`/`evaluateAll` are synchronous cache reads — they never call the
provider, so a broken provider can only degrade individual flags (via
`failureMode`), never throw out of an evaluation call. The one exception is
`evaluate()` on a key that was never registered, which throws synchronously
by design (a caller bug, not a runtime condition).

**Not thread-safe across concurrent contexts**: `setContext`/`getContext`
mutate shared instance state. Either instantiate one client per request
(e.g. per SSR request), or always pass `context` explicitly to
`evaluate`/`evaluateAll` and never call `setContext` on a shared instance.

`setOverrides()` forces a flag's resolved value/`variantKey` regardless of
`failureMode`, `dependsOn`, targeting, or remote state — `reason` is always
`"override"`, and overridden reads never fire `onEvaluate` handlers even
when `emitsExposure` is true. See the
[DevTools adapter](/docs/adapters/devtools/overview/), which builds on this.

### `TtlFlagStateCache`

```ts
interface TtlFlagStateCacheOptions {
  ttlMs?: number; // default 30_000
  staleWhileRevalidateMs?: number; // default 300_000
  retriggerCooldownMs?: number; // default = ttlMs
  onStale?: (key: string) => void;
}

class TtlFlagStateCache implements FlagStateCache {
  constructor(options?: TtlFlagStateCacheOptions);
  isStale(key: string): boolean;
  getStaleness(key: string): CacheStaleness; // "fresh" | "stale" | "unknown"
}

function wireAutoRevalidation(cache: TtlFlagStateCache, client: FlagsClient): Unsubscribe;
```

`get()`/`set()` are pure passthroughs on top of the default in-memory
cache — TTL age never changes what's returned or evicts data; the only
effect is the `onStale` side-channel. `wireAutoRevalidation` wires that
side-channel to call `client.refresh([key])` automatically. Pass an
instance as `FlagsClientOptions.cache`.

## Kind-sugar factories

Eight factory functions, each a pre-filled trait bundle over the same
`FlagDefinition` shape — not a separate evaluation path per "kind":

```ts
function defineReleaseFlag(options: DefineBooleanFlagOptions): FlagDefinition<boolean>;
function defineKillSwitch(options: DefineBooleanFlagOptions): FlagDefinition<boolean>;
function defineExperiment<T>(options: DefineExperimentOptions<T>): FlagDefinition<T>;
function defineMigrationFlag(options: DefineBooleanFlagOptions): FlagDefinition<boolean>;
function defineProgressiveDeploy(options: DefineBooleanFlagOptions): FlagDefinition<boolean>;
function defineEntitlementFlag(options: DefineBooleanFlagOptions): FlagDefinition<boolean>;
function defineCircuitBreaker(options: DefineBooleanFlagOptions): FlagDefinition<boolean>;
function defineDynamicConfig<T>(options: DefineDynamicConfigOptions<T>): FlagDefinition<T>;
```

`defaultValue` is always required — there are no hidden defaults. See
[Flag Taxonomy](/docs/concepts/flag-taxonomy/#kind-sugar-factories).

## Shadow-mode comparisons

```ts
function runShadow<T>(
  oldImpl: () => T,
  newImpl: () => T,
  onResult: ShadowResultHandler<T>,
): T;

function runShadowAsync<T>(
  oldImpl: () => Promise<T>,
  newImpl: () => Promise<T>,
  onResult: ShadowResultHandler<T>,
): Promise<T>;

function deepEqual(a: unknown, b: unknown): boolean;
```

Standalone utilities for comparing an old and new code path during a
migration — decoupled from `FlagDefinition`/`FlagsClient` so `evaluate()`
stays pure. Always returns the *old* implementation's result; a throwing
`newImpl` is caught and reported via `onResult`, never propagated.
