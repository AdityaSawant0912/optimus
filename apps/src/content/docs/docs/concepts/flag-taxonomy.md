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
| `failureMode`  | definition           | `'closed' \| 'open' \| 'lastKnown'` — outcome when the provider fails to fetch remote state |
| `rolloutPercentage` | remote state    | Percentage-based bucketing, see [Bucketing](/docs/concepts/bucketing/)    |
| `targetingRules`  | remote state      | Attribute/rule-based matching (`TargetingRule[]`)                        |
| `sticky`        | definition           | Whether the same bucketing key always resolves the same way              |
| `emitsExposure` | definition           | Fires every subscribed `onEvaluate` handler on `FlagsClient` whenever a flagged requested read resolves |
| `schedule`      | definition           | Optional `{ startAt?, endAt? }` time window                              |
| `dependsOn`     | definition           | Parent flag key(s) — this flag only evaluates if every parent is truthy  |

`failureMode` is enforced by `FlagsClient`, not the pure `evaluate()`
function — a bare `evaluate()` call always uses whatever remote state you
hand it, with no provider-failure concept to react to. When a
`FlagsClient`-owned provider fetch fails:

- **`'closed'`** (the default): falls back to the definition's
  `defaultValue`, `reason: 'fallbackError'`.
- **`'open'`**: a `boolean`-shaped flag fails open (`value: true`) instead
  of falling back to `defaultValue` — useful for flags that gate a
  fail-safe (e.g. "allow legacy checkout") rather than a new feature.
- **`'lastKnown'`**: if a previous successful fetch is cached, re-evaluates
  against that stale remote state (`stale: true`) instead of falling back.

`emitsExposure` is wired to `FlagsClient.onEvaluate()`: every handler
registered there fires on a requested (not `dependsOn`-internal) read of a
flag with `emitsExposure: true`. Overridden reads (via `setOverrides()`)
never fire exposure handlers, since a forced test read isn't a real user
exposure.

## `kind`

`FlagDefinition.kind` is one of:

```ts
type FlagKind =
  | "release" | "killSwitch" | "experiment" | "migration"
  | "progressiveDeploy" | "entitlement" | "circuitBreaker"
  | "dynamicConfig" | "custom";
```

`kind` is a plain string field — it's metadata for your own
bookkeeping/tooling, not something `evaluate()` branches on itself.

## Kind-sugar factories

`@useoptimus/core` ships 8 factory functions — `defineKillSwitch`,
`defineExperiment`, and others — that pre-fill trait defaults for a given
`kind` over the same `FlagDefinition` shape, rather than a separate
evaluation code path per kind:

```ts
import { defineKillSwitch, defineExperiment } from '@useoptimus/core';

const maintenanceMode = defineKillSwitch({ key: 'maintenance-mode', defaultValue: false });
```

Building a `FlagDefinition` object directly (see
[Quick Start](/docs/getting-started/quick-start/)) still works identically
— the factories are convenience, not a different code path.
