---
title: Migrations & Shadow Mode
description: Using defineMigrationFlag with runShadow/runShadowAsync to compare an old and new code path safely.
sidebar:
  order: 5
---

`defineMigrationFlag` and `runShadow`/`runShadowAsync` solve two different
halves of a "safer refactor" migration and are deliberately not coupled to
each other — the flag just decides which path runs; the shadow utilities
just compare two path's outputs. Combine them yourself.

## `defineMigrationFlag`

Boolean, sticky (a user doesn't flip between old/new mid-session), closed
fail-safe (falls back to the old path if the flag can't be evaluated):

```ts
import { defineMigrationFlag } from '@useoptimus/core';

const useNewPricingEngine = defineMigrationFlag({
  key: 'use-new-pricing-engine',
  defaultValue: false,
});
```

v1 is boolean-only via this factory. A `value`-shaped migration flag is
still possible by hand-authoring a `FlagDefinition` with `kind: 'migration'`
directly instead of using the factory — see [Quick
Start](/docs/getting-started/quick-start/#define-a-flag).

## Comparing old vs. new with `runShadowAsync`

Run the new implementation alongside the old one, purely for comparison —
`runShadowAsync` **always returns the old implementation's result**, so
calling it is safe to do unconditionally, even before you trust the new
path at all:

```ts
import { runShadowAsync, deepEqual } from '@useoptimus/core';

async function getPrice(cartId: string) {
  return runShadowAsync(
    () => legacyPricingEngine.calculate(cartId),   // old — always wins
    () => newPricingEngine.calculate(cartId),      // new — comparison only
    (result) => {
      if (!result.matched) {
        logger.warn('pricing engine mismatch', {
          cartId,
          old: result.old,
          new: result.new,
          error: result.error,
        });
      }
    },
  );
}
```

Semantics worth knowing before wiring this into a real code path:

- The **old** implementation's exceptions are never caught — a bug in
  `oldImpl` still throws out of `runShadowAsync` exactly as if you'd called
  it directly. Shadow-mode plumbing must never mask the real production
  path.
- The **new** implementation's exceptions *are* caught: `result.matched` is
  `false`, `result.new` is `undefined`, `result.error` holds what was
  thrown. Nothing propagates to the caller.
- Comparison uses `deepEqual` — structural equality for JSON-shaped values
  (primitives, plain objects, arrays). `Map`/`Set`/`Date`/class-instance
  identity are out of scope; normalize to plain data before comparing if
  your results contain those.
- `onResult` itself is wrapped in a try/catch — a broken logging callback
  can't break the call.

## Gating the new path with the flag

Put the flag decision around which branch actually executes, and use
`runShadowAsync` only while you still want the comparison data (typically:
before flipping the flag on for real traffic, to build confidence the two
paths agree):

```ts
async function getPrice(cartId: string, evaluated: EvaluatedFlag<boolean>) {
  if (!evaluated.value) {
    // Still shadow-comparing while on the old path, to catch divergence
    // before this flag is flipped on for anyone.
    return runShadowAsync(
      () => legacyPricingEngine.calculate(cartId),
      () => newPricingEngine.calculate(cartId),
      (result) => reportMismatch(cartId, result),
    );
  }
  return newPricingEngine.calculate(cartId);
}
```

Once the new path is trusted and the flag is fully rolled out, drop the
`runShadowAsync` call and the old implementation entirely — the flag and
the shadow comparison were never meant to be permanent.

## `runShadow` (sync)

Identical contract, for synchronous old/new implementations:

```ts
import { runShadow } from '@useoptimus/core';

const total = runShadow(
  () => oldTotal(items),
  () => newTotal(items),
  (result) => { if (!result.matched) reportMismatch(result); },
);
```

## Related: `defineCircuitBreaker`

Same boolean trait bundle as a migration flag (`closed` fail-safe), but a
different intent — meant to be flipped programmatically by a monitoring
system rather than manually, to disable a code path under load or error
conditions rather than to roll one out. See [Flag
Taxonomy](/docs/concepts/flag-taxonomy/#kind-sugar-factories) for the full
factory list.
