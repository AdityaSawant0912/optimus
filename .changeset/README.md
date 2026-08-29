# Changesets

This directory tracks per-package version bumps for the `feature-flags`
monorepo, since packages under `packages/*` are published independently
(see root `CLAUDE.md`).

## Adding a changeset

After a change that should trigger a release for one or more packages:

```bash
pnpm exec changeset
```

Pick the affected package(s), the bump type (major/minor/patch), and a
one-line summary. Commit the generated `.changeset/*.md` file alongside your
change.

## Releasing

```bash
pnpm exec changeset version   # consumes pending changesets, bumps versions, updates changelogs
pnpm exec changeset publish   # publishes any package whose version changed
```

`access` is set to `restricted` in `config.json` — flip a package's
`publishConfig.access` to `public` (or change this default) when it's
actually ready to ship to npm. Packages are currently `private: true`, so
`publish` is a no-op until that changes.
