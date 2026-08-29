# @feature-flags/angular

Angular adapter: `FeatureFlagService`, `provideFeatureFlags`, `*ifFeature`.

## Running tests

```bash
pnpm --filter @feature-flags/core build
pnpm --filter @feature-flags/node build
pnpm --filter @feature-flags/angular test
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
pipeline — imports like `@feature-flags/core` resolved to an unusable
module object at runtime (`LocalProvider is not a constructor`), because
the underlying TS file was never actually compiled.

**Fix:** `extra-webpack.config.cjs` adds a webpack `resolve.alias` pointing
`@feature-flags/core`/`@feature-flags/node` at their **built** `dist/`
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

## Jasmine vs. vitest gotcha

`spyOn()` (Jasmine) does **not** call through to the real implementation by
default, unlike `vi.spyOn()` (vitest, used elsewhere in this repo). Add
`.and.callThrough()` explicitly whenever a spied method's real side effect
still needs to happen for the test to be meaningful (see
`FeatureFlagService.context.test.ts`'s `setContext` spy).
