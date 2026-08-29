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
import type { FlagDefinition } from '@useoptimus/core';

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
import { evaluate } from '@useoptimus/core';

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
import type { FlagRemoteState } from '@useoptimus/core';

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
import { LocalProvider, evaluate } from '@useoptimus/core';

const provider = new LocalProvider([
  { key: 'show-new-nav', enabled: true, updatedAt: new Date().toISOString() },
]);

await provider.init();
const [remoteState] = await provider.getRemoteState(['show-new-nav']);
evaluate(showNewNav, remoteState, { userId: 'user_123' });
```

## Use `FlagsClient` instead of calling `evaluate()` directly

Calling `evaluate()` by hand works for a single flag, but for anything
real — remote state fetching, caching, `dependsOn` resolution across
multiple flags, live updates — use `FlagsClient`, which wraps a provider
and every registered `FlagDefinition`:

```ts
import { FlagsClient, LocalProvider } from '@useoptimus/core';

const client = new FlagsClient({
  definitions: [showNewNav],
  provider: new LocalProvider([
    { key: 'show-new-nav', enabled: true, updatedAt: new Date().toISOString() },
  ]),
});

await client.init();
client.evaluate('show-new-nav', { userId: 'user_123' });
client.evaluateAll({ userId: 'user_123' });
```

`FlagsClient` also owns `failureMode` semantics (`closed`/`open`/
`lastKnown`), `subscribe()` for live-update notification, and
`setOverrides()`/`clearOverrides()` for forcing a flag's value regardless of
everything else. `HttpPollingProvider` and `SseProvider` (also exported from
`@useoptimus/core`) fetch remote state over the network instead of
`LocalProvider`'s static array.

## Kind-sugar factories

For common flag shapes, `kinds.ts` ships pre-filled trait bundles instead of
writing out a `FlagDefinition` by hand:

```ts
import { defineKillSwitch, defineExperiment } from '@useoptimus/core';

const maintenanceMode = defineKillSwitch({ key: 'maintenance-mode', defaultValue: false });

const checkoutExperiment = defineExperiment({
  key: 'checkout-v2',
  defaultValue: 'control',
  variants: [
    { key: 'control', value: 'control', weight: 50 },
    { key: 'treatment', value: 'treatment', weight: 50 },
  ],
});
```

## Next

- [Bucketing & Salting](/docs/concepts/bucketing/) — how percentage rollouts
  and A/B variants are assigned.
- Pick your framework's adapter: [React](/docs/adapters/react/overview/),
  [Angular](/docs/adapters/angular/overview/), or
  [Node / SSR](/docs/adapters/node/overview/).
- [DevTools](/docs/adapters/devtools/overview/) — force a flag value during
  QA/E2E without touching remote state.
