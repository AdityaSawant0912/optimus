
# CLAUDE.md

Instructions for Claude Code (and any other agent) working in this repository.
Read this before writing any code. The full design spec lives in
[`PLAN.md`](./PLAN.md) — this file is the operational complement to it: how to
work, not what to build. If the two ever conflict, `PLAN.md` wins on *what*,
this file wins on *how*.

## What this repo is

A standalone TypeScript feature-flag library. A pure, framework-free core
evaluation engine, with thin adapters for React, Angular, and Node/SSR.
Monorepo, multiple packages, published independently.

## Before you start

1. Read `PLAN.md` in full, especially §9 (Decisions Log) and §11 (Phased
   Build Plan). Do not skim it.
2. Check which phase the repo is currently in (look at what exists under
   `packages/`). Do not start work on a later phase's package if an earlier
   phase isn't done and tested — the phases are ordered for a reason: later
   packages depend on the earlier ones being correct.
3. If this is a fresh checkout with nothing scaffolded yet, start at Phase 0.

## Hard constraints — do not silently deviate from these

These are copied from `PLAN.md §9` because they're easy to accidentally
violate mid-implementation. If you think one of these is wrong, **say so and
stop** — don't quietly work around it.

- Flag definitions are **hybrid**: code-defined schema + remotely-updatable
  state. Don't collapse this into "everything remote" or "everything static"
  for convenience.
- SSR evaluates **once**, server-side. The client **hydrates from a
  snapshot** — it does not re-run evaluation on mount. Only re-evaluate
  client-side on an explicit context change (e.g. login).
- The bucketing key is user-configurable via `EvaluationContext`, but there is
  always a **default resolution chain**: `userId → deviceId → sessionId → anonymousId`.
- The library **always** internally salts the hash input as
  `${bucketingKey}:${flagKey}${seed ? ':' + seed : ''}`. Never expose a raw
  "here's your hash, salt it yourself" API — salting is not optional and not
  the caller's responsibility.
- **Identity aliasing is out of scope for v1.** Do not attempt a partial
  implementation. Document the limitation instead (in code comments and in
  user-facing docs) rather than solving it halfway.
- Flags are modeled as **3 primitives** (`boolean` / `variant` / `value`) +
  composable traits — not as N separate parallel evaluation code paths per
  "kind" (kill switch, A/B test, etc.). "Kinds" are schema sugar/factory
  functions over the same engine, implemented in a later phase.
- The `core` package has **zero framework dependencies**. If you find
  yourself importing React, Angular, or `window`/`localStorage` inside
  `packages/core`, stop — that logic belongs in an adapter package instead.

## Working process

- **Work phase by phase**, in the order given in `PLAN.md §11`. Don't jump to
  the React adapter before the core engine has real test coverage.
- **Write tests alongside each phase, not after.** The bucketing and salting
  logic especially is easy to get subtly wrong — write a distribution/
  uniformity test and a "flags don't correlate" test before considering
  bucketing done.
- For anything listed in `PLAN.md §10` (Open Questions), pick a reasonable
  default, implement it, and call out the choice explicitly in your summary
  to the user — don't block on it, but don't bury the decision either.
- Keep `core` functions small and independently testable
  (bucketing, targeting, merge-remote-with-schema, and evaluate should all be
  separately unit-testable, not fused into one function).
- Use TypeScript strict mode in every package.
- When a phase is complete, summarize: what was built, what tests cover it,
  and any open-question defaults you picked.

## Repo conventions

- Package manager: pnpm workspaces (or Turborepo if the user has set that up —
  check for `turbo.json` / `pnpm-workspace.yaml` before assuming).
- One package per adapter (`packages/core`, `packages/react`,
  `packages/angular`, `packages/node`, `packages/devtools`), each independently
  versioned/publishable.
- Example apps live under `examples/`, one per framework, and should be kept
  runnable — they double as integration tests and as documentation.
- Prefer explicit types over inferred `any`/`unknown` leaking across package
  boundaries — this library's whole value proposition is type safety, don't
  undermine it internally.

## Commands

> Fill in once tooling is scaffolded (Phase 0). Placeholder for now:

```bash
# install
pnpm install

# run all tests
pnpm test

# run tests for a single package
pnpm --filter @feature-flags/core test

# typecheck everything
pnpm typecheck

# lint
pnpm lint

# build all packages
pnpm build
```

## When you're unsure

- Ambiguity about *what* to build → check `PLAN.md` first.
- Ambiguity about *how* to structure the work → this file.
- Still unsure, or the two docs seem to conflict → stop and ask the user
  rather than guessing on a decision that's expensive to unwind later
  (schema shape, bucketing algorithm, SSR contract especially).
