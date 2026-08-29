---
title: Angular Adapter
description: FeatureFlagService and the *ifFeature structural directive for Angular apps.
sidebar:
  order: 1
---

`@optimus/angular` provides `FeatureFlagService`, `provideFeatureFlags`, and
the `*ifFeature` structural directive.

## Install

```bash
npm install @optimus/angular
```

Peer dependencies: `@angular/core`/`@angular/common@^19.0.0 || ^20.0.0 || ^21.0.0 || ^22.0.0`,
`rxjs@^7.8.0`. The floor is 19 specifically because `takeUntilDestroyed()`
(used for the directive's cleanup) only reached stable, non-developer-preview
status in Angular 19.

## Usage

```ts
import { bootstrapApplication } from "@angular/platform-browser";
import { provideFeatureFlags } from "@optimus/angular";

bootstrapApplication(AppComponent, {
  providers: [provideFeatureFlags(client, snapshot)],
});
```

```ts
import { Component, inject } from "@angular/core";
import { FeatureFlagService, IfFeatureDirective } from "@optimus/angular";

@Component({
  standalone: true,
  imports: [IfFeatureDirective],
  template: `<div *ifFeature="'show-banner'">New banner!</div>`,
})
class BannerComponent {
  private readonly featureFlagService = inject(FeatureFlagService);
  variant$ = this.featureFlagService.flag$<string>("checkout-v2");
}
```

**No per-call `context` parameter** on `flag$(key)` — deliberately narrower
than the React adapter's `useFlag(key, context)`. `FlagsClient` itself only
exposes one ambient, mutable context field, and Angular has no
per-render-scoped unit like a React hook call to safely hang a stateless
override off of. Every caller shares the one ambient context; change it via
`featureFlagService.setContext(context)`.

**`*ifFeature` uses plain `Boolean(value)` truthiness** for any flag shape
(boolean/variant/value alike) — for variant-specific branching, use
`flag$(key) | async` with `*ngSwitch` directly instead.

**Call `provideFeatureFlags()` only from root `bootstrapApplication`
providers**, not from a lazy route's providers, unless you deliberately want
a route-scoped client. `FeatureFlagService` never calls
`client.init()`/`client.dispose()` itself — if it did, navigating away from
whichever lazy route happened to register a shared, app-lifetime client
would silently kill it the moment that route's `EnvironmentInjector` is torn
down (a real, not dev-only, event, unlike React StrictMode's dev-only
double-invoke).

## Testing

```bash
pnpm --filter @optimus/core build
pnpm --filter @optimus/node build
pnpm --filter @optimus/angular test
```

The two `build` steps are required: Angular's Karma test runner resolves
`@optimus/core`/`@optimus/node` via a webpack alias to their **built**
`dist/` output rather than raw TypeScript, since Angular's stock webpack
karma builder doesn't transform `.ts` reached through `node_modules`.
Requires Node `v24.15.0+`/`v22.22.3+`/`v26+` (Angular 22's CLI version gate).
