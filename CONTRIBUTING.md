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
   a changeset (see below).

## Releasing

This repo uses [changesets](https://github.com/changesets/changesets) for
independent per-package versioning:

```bash
pnpm exec changeset          # describe your change, pick affected package(s) + bump type
```

Commit the generated `.changeset/*.md` file with your PR. See
[`.changeset/README.md`](./.changeset/README.md) for the version/publish
flow.

## Scope

This is an early-stage library — see `PLAN.md` §11 for what phase the repo
is currently in before proposing work outside it.
