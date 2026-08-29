# @feature-flags/angular

Angular adapter: `FeatureFlagService`, `provideFeatureFlags`, `*ifFeature`.
Implementation is complete and typechecks cleanly (`pnpm typecheck`).

## Known issue: `pnpm test` does not run in this environment yet

**Root cause (confirmed, not a config typo):** Angular's webpack-based
`karma` builder does not transform `.ts` source reached through
`node_modules` — even a real, symlinked pnpm workspace package. Every
other package in this monorepo (`core`, `node`, `react`) is consumed via
`"main": "./src/index.ts"` (raw TypeScript), which works fine under
Vite/Vitest (which transforms `.ts` on the fly regardless of location) but
silently breaks under Angular's classic webpack test pipeline — imports
like `@feature-flags/core` resolve to an unusable module object at runtime
(`LocalProvider is not a constructor`), because the underlying TS file is
never actually compiled.

**The fix** (already wired up, see `extra-webpack.config.cjs` and
`angular.json`'s `test` target) is a webpack `resolve.alias` pointing
`@feature-flags/core`/`@feature-flags/node` at their **built** `dist/`
output instead of raw source, via `@angular-builders/custom-webpack:karma`.
Build the dependencies first:

```bash
pnpm --filter @feature-flags/core build
pnpm --filter @feature-flags/node build
```

**What's currently blocking it:** the only version of
`@angular-builders/custom-webpack` compatible with any installed Angular
major requires **Angular 22**, and Angular 22's CLI refuses to run on this
machine's installed Node (`v24.6.0`; Angular 22 requires `v24.15.0+`,
`v22.22.3+`, or `v26+`). This is a Node version gate, not a bug in this
package's code or config.

## To finish this once Node is upgraded

1. Upgrade Node to `v24.15.0+`/`v22.22.3+`/`v26+`.
2. `pnpm --filter @feature-flags/core build && pnpm --filter @feature-flags/node build`
3. `pnpm --filter @feature-flags/angular test`

If it still fails, re-verify the alias paths in `extra-webpack.config.cjs`
point at real `dist/index.js` files (rebuild if `dist/` is stale).

## Prior attempt: Vitest via `@analogjs/vite-plugin-angular`

Tried first, for consistency with the rest of the repo's vitest-based
packages. Hit a genuine, currently-tracked upstream bug
(`Error: module is already linked`, matching analogjs/analog#2027 —
"Angular plugin reinitialises environment") across both the vite5-era
(`1.9.x`) and current (`2.7.x`, requiring vite 6/7) release lines of
`@analogjs/vite-plugin-angular`/`@analogjs/vitest-angular`. Abandoned in
favor of Karma+Jasmine, which is the path documented above.
