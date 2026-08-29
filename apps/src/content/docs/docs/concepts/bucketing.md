---
title: Bucketing & Salting
description: How Optimus deterministically buckets users into flag variants and rollout percentages.
sidebar:
  order: 2
---

Percentage rollouts and A/B variant assignment both go through the same
bucketing primitives in `@optimus/core`.

## Resolving the bucketing key

`resolveBucketingKey` picks the identity to bucket on, in this order:

```ts
context.bucketingKey ?? context.userId ?? context.deviceId
  ?? context.sessionId ?? context.anonymousId ?? undefined
```

An explicit `bucketingKey` on `EvaluationContext` always wins over the
resolver chain. If none of these fields are set, the bucketing key is
`undefined` and any rollout/variant flag falls back to `defaultValue` with
reason `'default'`.

## Mandatory salting

You never construct the hash input yourself. `computeBucket` always salts
internally as:

```ts
`${bucketingKey}:${flagKey}${seed ? ':' + seed : ''}`
```

This is why two unrelated flags don't correlate — a user in the "top 10%"
for one rollout isn't automatically in the "top 10%" for another, because
each flag's key is part of the hash input. There is no API that hands you a
raw hash to salt yourself.

`seed` is `FlagRemoteState.bucketingSeed` — set it to re-randomize an
experiment's assignments on relaunch without changing the flag key.

## Hash function

The hash input is digested with FNV-1a, then passed through a MurmurHash3
`fmix32` finalizer (`avalanche`) before being reduced mod 10,000 (0.01%
resolution):

```ts
function computeBucket(bucketingKey: string, flagKey: string, seed?: string): number {
  const hashInput = buildHashInput(bucketingKey, flagKey, seed);
  return avalanche(fnv1a(hashInput)) % 10000;
}
```

FNV-1a alone doesn't fully avalanche when two inputs differ only in a
trailing byte — which is exactly the shape of `...:flag-a` vs. `...:flag-b`
— so the finalizer is applied on top to keep bucket assignments across
different flags independent. Both `fnv1a` and `computeBucket` are
deterministic pure-integer operations, so results match between Node and
browser V8.

## Rollout membership

```ts
function isInRollout(bucketValue: number, percentage: number): boolean
```

`percentage` is 0–100. `bucketValue` (0–9999) is compared against
`percentage * 100`; `0` is always false, `100` is always true.

## Variant assignment

For `variant`-shaped flags, the same `computeBucket` value is used to walk
the variant list in order, accumulating each variant's weight, and the first
variant whose cumulative weight exceeds the bucket wins. Weights don't need
to sum to 100 — they're normalized against the total.

:::caution
Identity aliasing (re-bucketing an anonymous user into their authenticated
bucket) is out of scope for v1. If a user is bucketed pre-login on
`anonymousId` and then authenticates, the resolved bucketing key changes to
`userId`, which can land them in a different bucket. There is no partial
workaround for this — it isn't attempted.
:::
