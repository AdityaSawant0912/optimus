---
title: React Adapter
description: useFlag, useVariant, and <FlagProvider> for React apps.
sidebar:
  order: 1
---

:::caution
`@feature-flags/react` is not implemented yet — there is no `packages/react`
in the repo. The API below is the planned shape from PLAN.md §8, not
something you can install today. Track [Installation](/docs/getting-started/installation/)
for when it ships.
:::

## Planned API

- `<FlagProvider client={flagsClient} snapshot={ssrSnapshot}>` — context
  provider; accepts an SSR snapshot to hydrate from without re-evaluating on
  mount (see [Node / SSR Adapter](/docs/adapters/node/overview/)).
- `useFlag<T>(key: string): EvaluatedFlag<T>` — reads a flag's current
  evaluation result.
- `useVariant(key: string): string` — sugar over `useFlag` for experiments.
- A Suspense-compatible variant, for cases where flags must resolve before
  render, is a later-phase addition.

Until this package exists, use `@feature-flags/core`'s `evaluate` directly
and pass results down via your own context/props — see
[Quick Start](/docs/getting-started/quick-start/).
