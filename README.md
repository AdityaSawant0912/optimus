# Optimus - Feature Flags

A standalone TypeScript feature-flag library for web applications — one core
evaluation engine, thin adapters for React, Angular, and Node/SSR.

> **Status:** early development. See [`PLAN.md`](./PLAN.md) for the full
> design spec and build phases. See [`CLAUDE.md`](./CLAUDE.md) for
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
  provider (HTTP polling, SSE/WebSocket, or a third-party flag service).
  If the remote source is unreachable, evaluation falls back to the
  code-defined default — this is also what makes kill switches fail safe.
- **SSR-first** — the server evaluates flags once and serializes a snapshot;
  the client hydrates from it instead of re-evaluating, so there's no flicker
  and no duplicate network calls.
- **Consistent, salted bucketing** — percentage rollouts and A/B assignment
  use a configurable bucketing key (with a sane default resolution chain) and
  are always internally salted per-flag, so bucket membership in one flag
  never correlates with bucket membership in another.
- **Framework adapters** — `useFlag`/`useVariant` hooks for React, an
  injectable `FeatureFlagService` + `*ifFeature` directive for Angular, and
  request-context helpers for Node backends.

## Flag types supported

Boolean release flags, kill switches, A/B tests / experiments, safer-refactor
(migration) flags, progressive deploy / ring rollouts, entitlement flags,
circuit breakers, dynamic config values, and scheduled flags. These are all
built from three primitive value shapes (`boolean` / `variant` / `value`) plus
composable behavioral traits — see [`PLAN.md §3`](./PLAN.md#3-flag-taxonomy)
for the full taxonomy.

## Known limitation (v1)

**Identity aliasing is not supported in v1.** If a user is bucketed
anonymously before logging in, they may be re-bucketed after authentication
because the resolved bucketing key changes. This is a deliberate scope cut —
see the [Decisions Log](./PLAN.md#9-decisions-log-do-not-silently-revisit) in
`PLAN.md`.

## Packages (planned layout)

```
packages/
├── core/       # pure TS evaluation engine — no framework deps
├── react/      # useFlag, useVariant, <FlagProvider>
├── angular/    # FeatureFlagService, *ifFeature directive
├── node/       # SSR context + snapshot helpers
└── devtools/   # local flag overrides for QA/E2E
```

## Documentation

- [`PLAN.md`](./PLAN.md) — full architecture, type sketches, bucketing
  design, decisions log, and phased build plan.
- [`CLAUDE.md`](./CLAUDE.md) — working instructions for AI coding agents
  (and a useful checklist for human contributors too).

## Getting started

Not published yet — this repo is in the scaffolding phase. See `PLAN.md §11`
for the build order (core engine first, then providers, SSR, then framework
adapters).

## License

TBD.
