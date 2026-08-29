# @optimus/angular

Angular adapter: `FeatureFlagService`, `provideFeatureFlags`, `*ifFeature`.

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

**`*ifFeature` uses plain `Boolean(value)` truthiness** for any flag
shape (boolean/variant/value alike) — for variant-specific branching, use
`flag$(key) | async` + `*ngSwitch` directly instead.

**Call `provideFeatureFlags()` only from root `bootstrapApplication`
providers**, not from a lazy route's providers, unless you deliberately
want a route-scoped client. `FeatureFlagService` never calls
`client.init()`/`client.dispose()` itself — if it did, navigating away
from whichever lazy route happened to register a shared, app-lifetime
client would silently kill it the moment that route's
`EnvironmentInjector` is torn down (a real, not dev-only, event, unlike
React StrictMode's dev-only double-invoke).

## Running tests

```bash
pnpm --filter @optimus/core build
pnpm --filter @optimus/node build
pnpm --filter @optimus/angular test
```

The two `build` steps are required — see "Why a custom webpack config"
below. Requires Node `v24.15.0+`/`v22.22.3+`/`v26+` (Angular 22's CLI
version gate).

## Why a custom webpack config

Angular's stock webpack-based `karma` builder doesn't transform `.ts`
source reached through `node_modules` — even a real, symlinked pnpm
workspace package. Every other package in this monorepo (`core`, `node`,
`react`) is consumed via `"main": "./src/index.ts"` (raw TypeScript), which
works fine under Vite/Vitest (which transforms `.ts` on the fly regardless
of location) but silently breaks under Angular's classic webpack test
pipeline — imports like `@optimus/core` resolved to an unusable
module object at runtime (`LocalProvider is not a constructor`), because
the underlying TS file was never actually compiled.

**Fix:** `extra-webpack.config.cjs` adds a webpack `resolve.alias` pointing
`@optimus/core`/`@optimus/node` at their **built** `dist/`
output instead of raw source, wired in via
`@angular-builders/custom-webpack:karma` (see `angular.json`'s `test`
target). Hence the `build` steps above must run first.

`@angular-builders/custom-webpack`'s only version compatible with any
Angular major requires **Angular 22**, which is why this package's dev
toolchain is pinned there even though `peerDependencies` allows `^19-^22`.

You'll see a deprecation notice for `@angular-devkit/build-angular:karma`
(which the custom-webpack builder wraps) pointing at `@angular/build:karma`
— Angular's newer esbuild-based test builder. That one doesn't support a
webpack-style `resolve.alias`, so it can't apply this fix; staying on the
webpack-based builder is intentional here, not an oversight.

## `pnpm build` (ng-packagr) currently fails — known, external

`packages/angular`'s own `build` script (`ng-packagr -p ng-package.json`,
for the eventual npm-publish path — see the package layout note in the
root `CLAUDE.md`) currently fails:

```
The Angular Compiler requires TypeScript >=6.0.0 and <6.1.0 but 5.9.3 was found instead.
```

This is a real upstream gap, not a local misconfiguration: TypeScript has
no stable release in the `>=6.0.0 <6.1.0` window at all — it went straight
from the 5.x line to `7.0.0` stable, with `6.0.0` only ever published as a
`-beta`/nightly-dev prerelease. Bumping this package's `typescript`
devDependency can't fix it; there's no compatible stable version to bump
*to* until either Angular's `ng-packagr`/`compiler-cli` widen that range or
a compatible TS release ships. This does not block anything else in the
workspace: `ng-packagr`'s output is only needed for a real `npm publish` of
this package (all packages here are still `private: true`), and every
workspace-internal consumer (this package's own tests, a future
`examples/angular-app`) uses raw TS source via `"main": "./src/index.ts"`,
the same as every other package — CI runs `tsc`-based builds for
`core`/`node`/`react`/`devtools`/`node-ssr-example` and skips `pnpm build`'s
angular step accordingly (see `.github/workflows/ci.yml`).

## Jasmine vs. vitest gotcha

`spyOn()` (Jasmine) does **not** call through to the real implementation by
default, unlike `vi.spyOn()` (vitest, used elsewhere in this repo). Add
`.and.callThrough()` explicitly whenever a spied method's real side effect
still needs to happen for the test to be meaningful (see
`FeatureFlagService.context.test.ts`'s `setContext` spy).
