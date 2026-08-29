# Contributing

Operational rules for working in this repo live in [`CLAUDE.md`](./CLAUDE.md)
(how to work) and [`PLAN.md`](./PLAN.md) (what to build, phase by phase).
Read those first — this file only covers the mechanics of making a change.

## Workspace layout

pnpm workspaces, packages under `packages/*` and `examples/*`
(`pnpm-workspace.yaml`). Each package is independently versioned/published —
see [Releasing](#releasing) below.

## Setup

```bash
pnpm install
```

## Making a change

1. Work phase-by-phase per `PLAN.md` §11 — don't start a later phase's
   package before an earlier one is done and tested.
2. Write tests alongside the code, not after (`*.test.ts` next to the
   module it covers, run via vitest).
3. Before opening a PR:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```
4. If your change touches a published package's behavior or public API, add
   a changeset (see below), and check [`VERSIONING.md`](./VERSIONING.md)
   for whether it counts as breaking.

## Adding a new `FlagProvider`

Implement the `FlagProvider` interface (`packages/core/src/types.ts`):
`name`, `init()`, `getRemoteState(keys?)`, and optionally `subscribe()` for
push-based updates. Add a co-located `*.test.ts` — reuse
`packages/core/src/test-utils/scripted-provider.ts`'s `ScriptedProvider`/
`PushCapableScriptedProvider` where they fit rather than writing a new test
double from scratch (see `providers/http-polling.test.ts`/`providers/sse.test.ts`
for the existing pattern). One bad response/push must never end future
polling/updates — every existing provider swallows a single failed
attempt and keeps going; a new one should too.

## Adding a new kind-sugar factory

Follow `packages/core/src/kinds.ts`'s existing pattern: an options object
extending `CommonFlagOptions` (`schedule`/`description`/`owners`/
`dependsOn`), `key` and `defaultValue` always required (no hidden default
— see the "explicit over guessing" precedent throughout this codebase),
and the kind's trait defaults (`kind`/`valueType`/`failureMode`/`sticky`/
`emitsExposure`) hardcoded so the compiler — not a runtime guard — prevents
a caller from clobbering them via the options spread. Add a row to
`packages/core/README.md`'s trait-default table and a table-driven test
case in `kinds.test.ts`.

## Releasing

This repo uses [changesets](https://github.com/changesets/changesets) for
independent per-package versioning:

```bash
pnpm exec changeset          # describe your change, pick affected package(s) + bump type
```

Commit the generated `.changeset/*.md` file with your PR. See
[`.changeset/README.md`](./.changeset/README.md) for the version/publish
flow, and [`VERSIONING.md`](./VERSIONING.md) for what counts as a breaking
change to this library's schema types.

## Scope

This is an early-stage library — see `PLAN.md` §11 for what phase the repo
is currently in before proposing work outside it.
