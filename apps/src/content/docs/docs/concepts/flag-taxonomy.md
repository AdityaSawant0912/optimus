---
title: Flag Taxonomy
description: The three primitive flag shapes and how behavioral traits compose on top of them.
sidebar:
  order: 1
---

Flags are modeled as three primitive value shapes plus composable traits —
not as a separate evaluation code path per "kind" like kill switch or A/B
test. A "kind" is schema sugar over the same `FlagDefinition` shape.

## Primitive shapes (`valueType`)

| Shape       | Description                                  | Example                    |
| ----------- | --------------------------------------------- | --------------------------- |
| `boolean` | On/off                                        | release flag, kill switch  |
| `variant` | One of N named, weighted variants             | A/B/C test                 |
| `value`   | Arbitrary typed payload                       | dynamic config value       |

## Traits

These fields live directly on `FlagDefinition` and `FlagRemoteState`:

| Field            | Source              | What it does                                                              |
| ---------------- | ------------------- | -------------------------------------------------------------------------- |
| `failureMode`  | definition           | `'closed' \| 'open' \| 'lastKnown'` — outcome when remote state is missing |
| `rolloutPercentage` | remote state    | Percentage-based bucketing, see [Bucketing](/docs/concepts/bucketing/)    |
| `targetingRules`  | remote state      | Attribute/rule-based matching (`TargetingRule[]`)                        |
| `sticky`        | definition           | Whether the same bucketing key always resolves the same way              |
| `emitsExposure` | definition           | Intended for A/B tests to fire exposure events; not yet wired to any event emitter in `core` |
| `schedule`      | definition           | Optional `{ startAt?, endAt? }` time window                              |
| `dependsOn`     | definition           | Parent flag key(s) — this flag only evaluates if every parent is truthy  |

`failureMode` is declared on every `FlagDefinition` but `core` currently only
implements the `'closed'` behavior: if remote state doesn't set a field, the
code-defined default is used. This *is* the kill-switch fail-safe path —
there's no separate error-handling branch. `'open'` and `'lastKnown'` are
part of the type but not yet given distinct evaluation semantics.

## `kind`

`FlagDefinition.kind` is one of:

```ts
type FlagKind =
  | "release" | "killSwitch" | "experiment" | "migration"
  | "progressiveDeploy" | "entitlement" | "circuitBreaker"
  | "dynamicConfig" | "custom";
```

`kind` is currently a plain string field you set yourself when constructing
a `FlagDefinition` — it's metadata for your own bookkeeping/tooling, not
something `evaluate()` branches on.

:::note
Factory helpers like `defineKillSwitch(...)` or `defineExperiment(...)` that
pre-fill trait defaults for a given `kind` are planned (see PLAN.md §3.3,
§11 Phase 6) but not implemented yet. Build a `FlagDefinition` object
directly for now — see [Quick Start](/docs/getting-started/quick-start/).
:::
