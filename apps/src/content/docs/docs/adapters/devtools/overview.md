---
title: DevTools
description: Local override panel and query-param/localStorage overrides for development.
sidebar:
  order: 1
---

`@optimus/devtools` provides local override resolution and a
framework-agnostic debug panel for forcing flag values during QA/E2E
testing.

## Install

```bash
npm install @optimus/devtools
```

## Resolving overrides from the environment

```ts
import { resolveOverridesFromEnvironment, applyOverridesToClient } from "@optimus/devtools";

const overrides = resolveOverridesFromEnvironment();
applyOverridesToClient(client, overrides); // client.setOverrides(overrides)
```

Resolved with explicit precedence — **query param > localStorage >
injected global** — most-ephemeral/most-explicit wins over most-persistent:

- **Query param**: a single JSON blob, `?__ff_overrides=<encoded JSON>`
  deserializing directly to `Record<string, FlagOverride>`. Not a per-flag
  `?ff.<key>=<value>` shorthand — a shorthand needs a string→`unknown`
  coercion mini-language (is `"true"` a boolean or a string?) that would
  reintroduce exactly the kind of silent guessing `@optimus/node`'s
  `buildContextFromRequest` explicitly refuses to do.
- **localStorage**: same shape, key `feature-flags:devtools:overrides`.
- **Injected global**: `window.__FEATURE_FLAGS_OVERRIDES__` — **not**
  `process.env`, which isn't ambiently available in a browser bundle.
  Populate it via your bundler's `define`/`DefinePlugin`, or a manual
  `<script>` tag, before the app bundle loads.

Malformed JSON at any source is treated as absent, falling through to the
next source. Every source is optional — `resolveOverridesFromEnvironment()`
returns `{}` with no throw when none are present (including outside a
browser, e.g. SSR).

## Overrides bypass everything

`client.setOverrides()` (called by `applyOverridesToClient` above) forces a
flag's resolved value/`variantKey` regardless of `failureMode`, `dependsOn`,
targeting, or remote state — `reason` is always `"override"`. Overridden
reads never fire `onEvaluate` exposure handlers, since a forced test read is
not a real user exposure and must not pollute experiment analytics. See
[Core API Reference](/docs/api/core/) for the full `EvaluationReason` union.

## Debug panel

```ts
import { registerFeatureFlagsPanel } from "@optimus/devtools";

registerFeatureFlagsPanel(); // idempotent
document.body.innerHTML += "<feature-flags-panel></feature-flags-panel>";
document.querySelector("feature-flags-panel").client = client;
```

A framework-agnostic Custom Element — composes with React, Angular, or
neither, with no new peer dependency. **v1 scope is deliberately minimal**:
one row per registered flag with a generic raw-JSON value input, an
optional variant-key input, and Apply/Clear buttons — no type-aware widgets
(no boolean toggle, no variant dropdown).

## Testing

```bash
pnpm --filter @optimus/devtools test
```
