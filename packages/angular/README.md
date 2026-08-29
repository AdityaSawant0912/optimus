# @useoptimus/angular

[![npm](https://img.shields.io/npm/v/@useoptimus/angular)](https://www.npmjs.com/package/@useoptimus/angular)

Angular adapter: `FeatureFlagService`, `provideFeatureFlags`, `*ifFeature`.

## Install

```bash
npm install @useoptimus/angular
```

Peer dependencies: `@angular/core`/`@angular/common@^19.0.0 || ^20.0.0 || ^21.0.0 || ^22.0.0`,
`rxjs@^7.8.0`. The floor is 19 specifically because `takeUntilDestroyed()`
(used for the directive's cleanup) only reached stable, non-developer-preview
status in Angular 19.

## Usage

```ts
import { bootstrapApplication } from "@angular/platform-browser";
import { provideFeatureFlags } from "@useoptimus/angular";

bootstrapApplication(AppComponent, {
  providers: [provideFeatureFlags(client, snapshot)],
});
```

```ts
import { Component, inject } from "@angular/core";
import { FeatureFlagService, IfFeatureDirective } from "@useoptimus/angular";

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
pnpm --filter @useoptimus/core build
pnpm --filter @useoptimus/node build
pnpm --filter @useoptimus/angular test
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
pipeline — imports like `@useoptimus/core` resolved to an unusable
module object at runtime (`LocalProvider is not a constructor`), because
the underlying TS file was never actually compiled.

**Fix:** `extra-webpack.config.cjs` adds a webpack `resolve.alias` pointing
`@useoptimus/core`/`@useoptimus/node` at their **built** `dist/`
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

## Publishing (`ng-packagr`)

`packages/angular`'s own `build` script runs `ng-packagr -p ng-package.json`,
which is a **separate build path** from every other package here: it
produces a self-contained `dist/` with its own generated `package.json`
(FESM bundle + `.d.ts` + `exports` map), not a straight `tsc` mirror of
`src/`. Publish this package **from `dist/`**, not from the package root:

```bash
pnpm --filter @useoptimus/angular build
cd packages/angular/dist
npm publish
```

`allowedNonPeerDependencies` in `ng-package.json` explicitly allowlists
`@useoptimus/core`/`@useoptimus/node` — `ng-packagr` refuses to ship a
non-peer dependency it hasn't been told is intentional, to catch a
framework peer (e.g. `@angular/core`) accidentally left as a regular
dependency. A `postbuild` script patches the generated `dist/package.json`'s
`main`/`types` to point at the real bundle/typings paths (`ng-packagr`
otherwise copies the source package.json's `"./src/index.ts"` values
verbatim into a directory that has no `src/`, which is harmless for
`exports`-aware resolvers but a broken fallback for anything that isn't).

### The TypeScript version gate — now resolved

This previously failed outright:

```
The Angular Compiler requires TypeScript >=6.0.0 and <6.1.0 but 5.9.3 was found instead.
```

At the time, TypeScript had no stable release in that window — it had
jumped straight from the 5.x line towards `7.0.0`, with `6.0.0` published
only as a `-beta`/nightly-dev prerelease. TypeScript later backfilled
stable `6.0.x` point releases, landing inside Angular's required range.
This package's `typescript` devDependency is pinned to `^6.0.2` — separate
from the rest of the workspace, which stays on `^5.6.3` — since a pnpm
workspace resolves each package's own declared range independently.
`tslib` was also added as a real dependency: Angular's decorator-metadata
emit requires it, and `ng-packagr` fails the build (`TS2354`) without it.

## Jasmine vs. vitest gotcha

`spyOn()` (Jasmine) does **not** call through to the real implementation by
default, unlike `vi.spyOn()` (vitest, used elsewhere in this repo). Add
`.and.callThrough()` explicitly whenever a spied method's real side effect
still needs to happen for the test to be meaningful (see
`FeatureFlagService.context.test.ts`'s `setContext` spy).
