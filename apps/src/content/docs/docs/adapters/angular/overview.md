---
title: Angular Adapter
description: FeatureFlagService and the *ifFeature structural directive for Angular apps.
sidebar:
  order: 1
---

:::caution
`@feature-flags/angular` is not implemented yet — there is no
`packages/angular` in the repo. The API below is the planned shape from
PLAN.md §8, not something you can install today.
:::

## Planned API

- `FeatureFlagService` — injectable, RxJS-based:
  `flag$(key): Observable<EvaluatedFlag<T>>`.
- `*ifFeature="'flag-key'"` — structural directive for template conditionals.
- Standalone-component friendly, no `NgModule` requirement.

Until this package exists, call `@feature-flags/core`'s `evaluate` directly
from a service you write yourself — see
[Quick Start](/docs/getting-started/quick-start/).
