# Versioning & migration policy

Each package under `packages/*` is versioned and published independently
via [changesets](https://github.com/changesets/changesets) — see
[`.changeset/README.md`](./.changeset/README.md) for the day-to-day
add-a-changeset/version/publish flow. This document covers what actually
counts as a breaking change for this library's schema types, since those
are shared across every package.

## `FlagDefinition` / `FlagRemoteState` / `EvaluationContext`

**Breaking** (major bump for `@useoptimus/core`, and for every package
depending on it that re-exports or consumes the changed field):

- Removing a field.
- Renaming a field.
- Narrowing or changing a field's type (e.g. `defaultValue: T` becoming
  `defaultValue: T | null`, or `owners?: string[]` becoming
  `owners: string[]`).
- Changing the runtime meaning of an existing field without changing its
  type (a "breaking behavior change," not a type-level one — still needs a
  major bump and a `VERSIONING.md`/changelog callout).

**Non-breaking** (patch or minor, per changesets' own semver judgment):

- Adding a new **optional** field.
- Adding a new value to `FlagKind` (see below — with a caveat) or a new
  `TargetingRule` variant (see below — with the same caveat).
- Widening a field's type (e.g. `attributes?: Record<string, string>` to
  `Record<string, string | number | boolean>`, which already happened once
  during this library's own development and did not require a major bump).

## `FlagKind` / `TargetingRule` — discriminated unions

Both are open string-literal/discriminated unions. **Adding a new
variant is non-breaking for the library itself**, but only *safe* for a
consumer if their own code pattern-matches with a `default`/exhaustiveness
fallback rather than an exhaustive switch with no default case — a
consumer relying on TypeScript's exhaustiveness checking (`never` in a
`default:` branch) to catch every `FlagKind`/`TargetingRule.type` will get
a compile error the moment a new variant ships, even on a minor version.
This is called out explicitly rather than silently treating "we added an
enum member" as risk-free: it's non-breaking by the *library's* own
compatibility promise, but consumers doing exhaustive matching should
treat a minor bump here the same care as a major one.

## `FlagKind` deprecation policy

Add-only. A `FlagKind` value is never removed without a major version bump
across every package that depends on `@useoptimus/core` (since the
adapters don't independently define this type). A deprecated kind gets a
`@deprecated` JSDoc tag on its `defineXxx` factory (if one exists in
`kinds.ts`) for at least one minor version before any removal, pointing at
its replacement.

## Provider interface (`FlagProvider`)

Adding an optional method (following `subscribe`'s existing optional-method
precedent) is non-breaking. Changing `init()`/`getRemoteState()`'s
signature, or making `subscribe` required, is breaking for every
hand-written `FlagProvider` implementation in the wild — treat this
interface as conservatively as the schema types above.
