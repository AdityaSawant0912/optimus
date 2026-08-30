---
title: DevTools API Reference
description: resolveOverridesFromEnvironment, applyOverridesToClient, and the debug panel element.
sidebar:
  order: 5
---

Hand-written reference for everything `@useoptimus/devtools` exports today
(`packages/devtools/src/index.ts`). See the [DevTools adapter guide](/docs/adapters/devtools/overview/)
for usage and override precedence.

## Overrides

### `resolveOverridesFromEnvironment(sources?)`

```ts
interface OverrideSources {
  location?: Pick<Location, "search">;
  storage?: Pick<Storage, "getItem">;
  globalOverrides?: unknown; // e.g. window.__FEATURE_FLAGS_OVERRIDES__
}

function resolveOverridesFromEnvironment(
  sources?: OverrideSources, // defaults to reading window/localStorage
): Record<string, FlagOverride>;
```

Resolves with precedence **query param (`__ff_overrides`) > localStorage
(`feature-flags:devtools:overrides`) > injected global**. Malformed JSON at
any source is treated as absent, falling through to the next. Returns `{}`
outside a browser (e.g. SSR) or when no source is present, instead of
throwing.

### `applyOverridesToClient(client, overrides)`

```ts
function applyOverridesToClient(client: FlagsClient, overrides: Record<string, FlagOverride>): void;
```

One-line convenience for `client.setOverrides(overrides)`. `FlagOverride`
comes from [`@useoptimus/core`](/docs/api/core/); overridden reads always
resolve with `reason: "override"` and never fire `onEvaluate` exposure
handlers.

## Debug panel

### `FeatureFlagsPanelElement` / `registerFeatureFlagsPanel`

```ts
class FeatureFlagsPanelElement extends HTMLElement {
  client: FlagsClient | undefined; // settable property, not an HTML attribute
}

function registerFeatureFlagsPanel(): void; // idempotent
```

`registerFeatureFlagsPanel()` defines the `<feature-flags-panel>` custom
element (a no-op if already defined). Setting `.client` subscribes to
`client.subscribe()` and renders one row per registered flag — a
raw-JSON value input, an optional variant-key input, and Apply/Clear
buttons that call `client.setOverrides()`/`client.clearOverrides()`. v1
scope is deliberately minimal: no type-aware widgets (no boolean toggle, no
variant dropdown).
