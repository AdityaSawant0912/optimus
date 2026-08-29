# Optimus - Feature Flags

[![npm](https://img.shields.io/npm/v/@useoptimus/core)](https://www.npmjs.com/package/@useoptimus/core)

A standalone TypeScript feature-flag library for web applications — one core
evaluation engine, thin adapters for React, Angular, and Node/SSR.

> **Status:** published. Core, Node, React, Angular, and DevTools are all
> live on npm under the `@useoptimus` scope. See [`PLAN.md`](./PLAN.md) for
> the full design spec and build phases, and [`CLAUDE.md`](./CLAUDE.md) for
> contributor/agent working instructions.

## Why this exists

Most flag libraries make you choose between "type-safe but only code-defined"
and "flexible but stringly-typed and remote-only." This library does both:
flags are declared in code (so you get autocomplete and compile-time safety),
but their live state — enabled/disabled, rollout percentage, targeting rules —
can be updated remotely without a redeploy.

## Features

- **One engine, every environment** — the core evaluation logic is pure
  TypeScript with zero framework dependencies. It runs identically in the
  browser, in Node, during SSR, or inside a serverless function.
- **Hybrid flag definitions** — schema in code, live state from a remote
  provider (HTTP polling, SSE, or a static/local source for tests). If the
  remote source is unreachable, evaluation falls back to the code-defined
  default per a configurable `failureMode` — this is also what makes kill
  switches fail safe.
- **SSR-first** — the server evaluates flags once and serializes a snapshot;
  the client hydrates from it instead of re-evaluating, so there's no flicker
  and no duplicate network calls.
- **Consistent, salted bucketing** — percentage rollouts and A/B assignment
  use a configurable bucketing key (with a sane default resolution chain) and
  are always internally salted per-flag, so bucket membership in one flag
  never correlates with bucket membership in another.
- **Framework adapters** — `useFlag`/`useVariant` hooks for React, an
  injectable `FeatureFlagService` + `*ifFeature` directive for Angular, and
  request-context/snapshot helpers for Node backends.
- **DevTools** — local override resolution (query param / `localStorage` /
  injected global) and a framework-agnostic debug panel for QA/E2E.

## Flag types supported

Boolean release flags, kill switches, A/B tests / experiments, safer-refactor
(migration) flags, progressive deploy / ring rollouts, entitlement flags,
circuit breakers, and dynamic config values — each a factory over three
primitive value shapes (`boolean` / `variant` / `value`) plus composable
behavioral traits, not a separate evaluation path per kind. See
[`PLAN.md §3`](./PLAN.md#3-flag-taxonomy) for the full taxonomy.

## Known limitation (v1)

**Identity aliasing is not supported in v1.** If a user is bucketed
anonymously before logging in, they may be re-bucketed after authentication
because the resolved bucketing key changes. This is a deliberate scope cut —
see the [Decisions Log](./PLAN.md#9-decisions-log-do-not-silently-revisit) in
`PLAN.md`.

## Packages

| Package | | |
| --- | --- | --- |
| [`@useoptimus/core`](./packages/core) | pure TS evaluation engine, `FlagsClient`, providers, bucketing | [![npm](https://img.shields.io/npm/v/@useoptimus/core)](https://www.npmjs.com/package/@useoptimus/core) |
| [`@useoptimus/react`](./packages/react) | `useFlag`, `useVariant`, `<FlagProvider>` | [![npm](https://img.shields.io/npm/v/@useoptimus/react)](https://www.npmjs.com/package/@useoptimus/react) |
| [`@useoptimus/angular`](./packages/angular) | `FeatureFlagService`, `*ifFeature` directive | [![npm](https://img.shields.io/npm/v/@useoptimus/angular)](https://www.npmjs.com/package/@useoptimus/angular) |
| [`@useoptimus/node`](./packages/node) | SSR request context + snapshot hydration | [![npm](https://img.shields.io/npm/v/@useoptimus/node)](https://www.npmjs.com/package/@useoptimus/node) |
| [`@useoptimus/devtools`](./packages/devtools) | local flag overrides for QA/E2E | [![npm](https://img.shields.io/npm/v/@useoptimus/devtools)](https://www.npmjs.com/package/@useoptimus/devtools) |

## Documentation

Full docs site (guides, adapter overviews, API reference) lives under
[`apps/`](./apps) — see [Installation](./apps/src/content/docs/docs/getting-started/installation.md)
and [Quick Start](./apps/src/content/docs/docs/getting-started/quick-start.md)
to get going. Also:

- [`PLAN.md`](./PLAN.md) — full architecture, type sketches, bucketing
  design, decisions log, and phased build plan.
- [`CLAUDE.md`](./CLAUDE.md) — working instructions for AI coding agents
  (and a useful checklist for human contributors too).

## Getting started

```bash
npm install @useoptimus/core
npm install @useoptimus/react     # or @useoptimus/angular, @useoptimus/node
```

See [Installation](./apps/src/content/docs/docs/getting-started/installation.md)
for the full per-adapter install matrix.

## License

MIT — see [`LICENSE.md`](./LICENSE.md).
