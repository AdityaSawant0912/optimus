---
title: Angular API Reference
description: FeatureFlagService, provideFeatureFlags, and the *ifFeature directive.
sidebar:
  order: 3
---

Hand-written reference for everything `@useoptimus/angular` exports today
(`packages/angular/src/index.ts`). See the [Angular adapter guide](/docs/adapters/angular/overview/)
for usage.

## `provideFeatureFlags(client, snapshot?)`

```ts
function provideFeatureFlags(client: FlagsClient, snapshot?: SerializedSnapshot): EnvironmentProviders;
```

Registers `FLAGS_CLIENT`/`FLAGS_SNAPSHOT` and `FeatureFlagService`. Call
only from root `bootstrapApplication()` providers unless a route-scoped
client is deliberately wanted — never calls `client.init()`/`client.dispose()`
itself, and a lazy route's `EnvironmentInjector` teardown is a real (not
dev-only) event.

## `FeatureFlagService`

```ts
@Injectable()
class FeatureFlagService {
  flag$<T = boolean>(key: string): Observable<EvaluatedFlag<T>>;
  setContext(context: EvaluationContext): void;
}
```

`flag$(key)` has **no per-call `context` parameter** — deliberately narrower
than the React adapter's `useFlag(key, context)`, since `FlagsClient` only
exposes one ambient, mutable context field and Angular has no
per-render-scoped unit to hang a stateless override off of. Every caller
shares the one ambient context; `setContext()` is the only way to change it,
and flips the service from snapshot mode to live mode.

In snapshot mode, `flag$(key)` returns an `Observable` that emits the
hydrated snapshot's value for `key` once, synchronously — no client calls.
In live mode it's `shareReplay({ bufferSize: 1, refCount: true })`-cached
per key, re-emitting on `client.subscribe()` updates for that key and on
`setContext()` calls.

## `IfFeatureDirective`

```ts
@Directive({ selector: "[ifFeature]", standalone: true })
class IfFeatureDirective implements OnInit {
  ifFeature: string; // required input
}
```

Structural directive (`*ifFeature="'key'"`). Shows/hides its template based
on plain `Boolean(flag.value)` truthiness for any flag shape (boolean,
variant, or value alike) — no `valueType`-specific branching. For
variant-specific rendering, use `flag$(key) | async` with `*ngSwitch`
directly instead.

## Tokens

```ts
const FLAGS_CLIENT: InjectionToken<FlagsClient>;
const FLAGS_SNAPSHOT: InjectionToken<SerializedSnapshot | undefined>;
```

Injection tokens `provideFeatureFlags` registers `FeatureFlagService`
against. Only needed directly if you're constructing the provider set by
hand instead of via `provideFeatureFlags`.

`FlagsClient`, `EvaluationContext`, and `EvaluatedFlag<T>` come from
[`@useoptimus/core`](/docs/api/core/); `SerializedSnapshot` comes from
[`@useoptimus/node`](/docs/api/node/).
