---
title: Quick Start
description: Define your first flag and evaluate it in under five minutes.
sidebar:
  order: 2
---

## Define a flag

A flag is a plain `FlagDefinition` object — there's no builder function, the
schema fields are the API:

```ts
import type { FlagDefinition } from '@feature-flags/core';

const showNewNav: FlagDefinition<boolean> = {
  key: 'show-new-nav',
  kind: 'release',
  valueType: 'boolean',
  defaultValue: false,
  failureMode: 'closed',
  sticky: false,
  emitsExposure: false,
};
```

See [Flag Taxonomy](/docs/concepts/flag-taxonomy/) for what each field means.

## Evaluate it

```ts
import { evaluate } from '@feature-flags/core';

const result = evaluate(showNewNav, undefined, { userId: 'user_123' });
// { key: 'show-new-nav', value: false, reason: 'default', stale: false, variantKey: undefined }
```

`evaluate` takes the flag definition, optional remote state (`undefined`
means "no remote state available" — the definition's `defaultValue` and
`failureMode` govern the outcome), and an `EvaluationContext` carrying the
bucketing key.

## Add remote state

Remote state overrides the schema field-by-field. Turning the flag on
without redeploying:

```ts
import type { FlagRemoteState } from '@feature-flags/core';

const remoteState: FlagRemoteState = {
  key: 'show-new-nav',
  enabled: true,
  updatedAt: new Date().toISOString(),
};

evaluate(showNewNav, remoteState, { userId: 'user_123' });
// { key: 'show-new-nav', value: true, reason: 'override', ... }
```

## Fetch remote state from a provider

`LocalProvider` is the in-memory/static provider — useful for tests and
local dev before wiring up a real network provider:

```ts
import { LocalProvider, evaluate } from '@feature-flags/core';

const provider = new LocalProvider([
  { key: 'show-new-nav', enabled: true, updatedAt: new Date().toISOString() },
]);

await provider.init();
const [remoteState] = await provider.getRemoteState(['show-new-nav']);
evaluate(showNewNav, remoteState, { userId: 'user_123' });
```

Next: [Bucketing & Salting](/docs/concepts/bucketing/) covers how percentage
rollouts and A/B variants are assigned.
