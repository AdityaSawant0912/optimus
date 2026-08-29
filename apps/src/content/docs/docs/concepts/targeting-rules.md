---
title: Targeting Rules
description: Writing TargetingRule conditions and composing them with and/or.
sidebar:
  order: 4
---

`FlagRemoteState.targetingRules` is a `TargetingRule[]` — a list evaluated
**first-match-wins**, not "all rules must match." This page walks through
each rule type and how the list itself is evaluated.

## Rule types

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

### `attributeEquals`

Matches `context.attributes[attribute] === value`:

```ts
{ type: 'attributeEquals', attribute: 'plan', value: 'enterprise' }
```

### `attributeIn`

Matches when the attribute is a string or number present in `values`:

```ts
{ type: 'attributeIn', attribute: 'countryCode', values: ['US', 'CA', 'MX'] }
```

### `percentageRollout`

Bucketed via [the same bucketing key + salting](/docs/concepts/bucketing/)
as everything else — `bucketingSeed`, if given, changes the salt so this
rule's rollout doesn't correlate with other flags' or other rules'
rollouts:

```ts
{ type: 'percentageRollout', percentage: 25, bucketingSeed: 'checkout-v2-ring-1' }
```

If no bucketing key resolves for the context (see the [resolution
chain](/docs/concepts/bucketing/)), this rule never matches.

### `semverRange`

Matches when `context.attributes[attribute]` is a string satisfying a
[node-semver](https://github.com/npm/node-semver) range:

```ts
{ type: 'semverRange', attribute: 'appVersion', range: '>=4.2.0' }
```

### `dateRange`

Matches when `Date.now()` falls within `[startAt, endAt]` (either bound is
optional — an open start or open end):

```ts
{ type: 'dateRange', startAt: '2026-09-01T00:00:00Z', endAt: '2026-09-15T00:00:00Z' }
```

## Composing with `and` / `or`

`and` requires every nested rule to match; `or` requires at least one.
They nest arbitrarily:

```ts
{
  type: 'and',
  rules: [
    { type: 'attributeEquals', attribute: 'plan', value: 'enterprise' },
    {
      type: 'or',
      rules: [
        { type: 'attributeIn', attribute: 'region', values: ['us-east', 'us-west'] },
        { type: 'attributeEquals', attribute: 'betaOptIn', value: true },
      ],
    },
  ],
}
```

Reads as: enterprise plan **and** (US region **or** opted into beta).

## First-match-wins over the list

`targetingRules` on `FlagRemoteState` is a flat list, not a single
composite rule — put your `and`/`or` composition inside one list entry when
you need multiple conditions on one match, and use separate list entries
when you want independent fallback rules tried in order:

```ts
const targetingRules: TargetingRule[] = [
  { type: 'attributeEquals', attribute: 'internalTester', value: true },
  { type: 'attributeEquals', attribute: 'plan', value: 'enterprise' },
  { type: 'percentageRollout', percentage: 10 },
];
```

The engine walks this list top to bottom and stops at the first rule that
matches (`evaluateRules` in `@useoptimus/core`, which `evaluate()` calls
internally — see [`evaluateRules`](/docs/api/core/#evaluaterulesrules-context-flagkey)).
An internal tester always matches the first rule regardless of plan; a
non-tester enterprise user matches the second; everyone else falls through
to the 10% rollout. A matched rule produces `reason: 'targetingMatch'` (or
`'rollout'` for a `percentageRollout` match) on the `EvaluatedFlag` — note
that `EvaluatedFlag.ruleMatched` is typed but not currently populated by
`evaluate()`; use `evaluateRules()` directly (it returns `{ matched, rule
}`) if you need to know *which* rule fired.

If no rule matches, evaluation falls through to `rolloutPercentage` /
`defaultValue` handling as usual — see [Flag
Taxonomy](/docs/concepts/flag-taxonomy/#traits).
