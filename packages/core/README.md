# @useoptimus/core

[![npm](https://img.shields.io/npm/v/@useoptimus/core)](https://www.npmjs.com/package/@useoptimus/core)

Pure, framework-free feature-flag evaluation engine. No React, no Angular,
no `window`/`localStorage` — this package runs identically in Node, the
browser, or an edge worker. Framework adapters (`@useoptimus/react`,
`@useoptimus/angular`) and Node/SSR helpers (`@useoptimus/node`) are
thin layers on top of this one.

## Install

```bash
npm install @useoptimus/core
```

## Flags are 3 primitives + composable traits

Every flag is one of three value shapes:

| Shape | Description |
| --- | --- |
| `boolean` | On/off |
| `variant` | One of N named, weighted variants (A/B/C test) |
| `value` | Arbitrary typed payload (dynamic config) |

Traits (`failureMode`, `sticky`, `emitsExposure`, `dependsOn`, `schedule`)
compose on top of these — there are no separate evaluation code paths per
"kind" (kill switch, experiment, etc.). `kinds.ts` ships 8 factory
functions (`defineKillSwitch`, `defineExperiment`, ...) that are just
pre-filled trait bundles over the same `FlagDefinition` shape:

```ts
import { defineKillSwitch, defineExperiment } from "@useoptimus/core";

const maintenanceMode = defineKillSwitch({ key: "maintenance-mode", defaultValue: false });

const checkoutExperiment = defineExperiment({
  key: "checkout-v2",
  defaultValue: "control",
  variants: [
    { key: "control", value: "control", weight: 50 },
    { key: "treatment", value: "treatment", weight: 50 },
  ],
});
```

## Evaluating flags

`evaluate()` is pure and deterministic: identical `(definition, remoteState,
context)` always produces an identical `EvaluatedFlag`. This is what makes
SSR snapshot/hydrate parity possible (see `@useoptimus/node`).

```ts
import { evaluate } from "@useoptimus/core";

const result = evaluate(maintenanceMode, undefined, { userId: "user_123" });
// { key: "maintenance-mode", value: false, reason: "default", stale: false }
```

For anything beyond a single one-off `evaluate()` call — remote state
fetching, caching, `dependsOn` resolution across multiple flags, live
updates — use `FlagsClient` instead of calling `evaluate()` directly:

```ts
import { FlagsClient, LocalProvider } from "@useoptimus/core";

const client = new FlagsClient({
  definitions: [maintenanceMode, checkoutExperiment],
  provider: new LocalProvider([{ key: "maintenance-mode", enabled: true, updatedAt: new Date().toISOString() }]),
});

await client.init();
client.evaluate("maintenance-mode", { userId: "user_123" });
client.evaluateAll({ userId: "user_123" });
```

`FlagsClient` also owns `failureMode` semantics (`closed`/`open`/
`lastKnown`), `subscribe()` for live-update notification, and
`setOverrides()`/`clearOverrides()` for forcing a flag's value regardless
of everything else (used by `@useoptimus/devtools`, but callable
directly too — see its doc comment in `client.ts` for the exact
short-circuit semantics).

## Bucketing & salting

Percentage rollouts and variant assignment share one bucketing primitive.

**Default identity resolution chain** (first non-null wins, unless an
explicit `bucketingKey` is set): `userId → deviceId → sessionId → anonymousId`.

**Mandatory internal salting** — you never construct the hash input
yourself. The library always salts as:

```
${bucketingKey}:${flagKey}${seed ? ':' + seed : ''}
```

This is why two unrelated flags don't correlate: a user in the "top 10%"
of one rollout isn't automatically in the "top 10%" of another, because
each flag's key is part of the hash input.

**Hash function**: FNV-1a, then a MurmurHash3 `fmix32` finalizer
(`avalanche`), reduced mod 10,000 (0.01% resolution). FNV-1a alone doesn't
fully avalanche when two inputs differ only in a trailing byte — exactly
the shape of `...:flag-a` vs. `...:flag-b` — so the finalizer keeps bucket
assignments across different flags independent. Both are pure integer
operations, deterministic across Node and browser V8.

```ts
import { computeBucket, isInRollout } from "@useoptimus/core";

const bucket = computeBucket("user_123", "checkout-v2"); // [0, 10000)
isInRollout(bucket, 25); // true for ~25% of users
```

## Identity aliasing is out of scope (v1)

If a user is bucketed anonymously pre-login (on `anonymousId`) and then
authenticates (resolving to `userId`), they may land in a **different**
bucket, because the resolved bucketing key changed. There is no partial
workaround for this — it isn't attempted. If your flags need bucket
continuity across login, pass an explicit `bucketingKey` yourself that
stays stable across the transition.

## Providers

`FlagProvider` is the interface for fetching remote flag state — three
ship with this package:

- `LocalProvider` — static in-memory state, for tests and local dev.
- `HttpPollingProvider` — polls a URL on an interval, with Equal Jitter
  exponential backoff on failure.
- `SseProvider` — server-sent-events push; `getRemoteState()` returns the
  last-known pushed state (`[]` before the first message), not a network
  fetch.

`TtlFlagStateCache` (30s TTL / 5min stale-while-revalidate by default)
plugs into `FlagsClient`'s `cache` option and can auto-trigger `refresh()`
on staleness via `wireAutoRevalidation(cache, client)`.

## Shadow-mode comparisons

`runShadow`/`runShadowAsync` are standalone utilities for comparing an old
and new code path during a migration — decoupled from `FlagDefinition`/
`FlagsClient` so `evaluate()` stays pure:

```ts
import { runShadow } from "@useoptimus/core";

const migrationFlag = client.evaluate<boolean>("checkout-v2-migration");
const result = migrationFlag.value
  ? newCheckout(order)
  : runShadow(
      () => oldCheckout(order),
      () => newCheckout(order),
      (r) => { if (!r.matched) logger.warn("checkout-v2 mismatch", r); },
    );
```

Always returns the *old* implementation's result; a throwing `newImpl` is
caught and reported via `onResult`, never propagated.

## Testing

```bash
pnpm --filter @useoptimus/core test
```
