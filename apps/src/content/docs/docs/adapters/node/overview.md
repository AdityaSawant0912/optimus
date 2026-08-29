---
title: Node / SSR Adapter
description: Server-side evaluation and snapshot serialization for SSR hydration.
sidebar:
  order: 1
---

:::caution
`@feature-flags/node` is not implemented yet — there is no `packages/node`
in the repo. The API below is the planned shape from PLAN.md §8, not
something you can install today.
:::

## The SSR contract

This adapter exists to implement a contract that's already locked in at the
core level (PLAN.md §4.3, Decision #2): the server evaluates flags **once**,
and the client **hydrates from that snapshot** — it does not re-evaluate on
mount. Re-evaluation only happens on an explicit context change (e.g. login)
or the next server round-trip. `evaluate()` in `@feature-flags/core` is pure
and deterministic specifically so a server-produced `EvaluatedFlag` and a
client-hydrated one are guaranteed identical for the same inputs.

## Planned API

- `buildContextFromRequest(req): EvaluationContext` — framework-agnostic
  helper that builds a context from request data (headers, cookies, auth,
  org id) instead of `window`/`localStorage`, which don't exist server-side.
- `serializeSnapshot(evaluatedFlags): SerializedSnapshot` — flattens
  evaluated flags into a `{ [flagKey]: EvaluatedFlag }` payload for embedding
  in the initial HTML/JSON response.

Until this package exists, call `evaluate()` from `@feature-flags/core`
directly with a context you build from the request yourself, and serialize
the resulting `EvaluatedFlag` objects however your SSR framework expects.
