---
title: DevTools
description: Local override panel and query-param/localStorage overrides for development.
sidebar:
  order: 1
---

:::caution
`@feature-flags/devtools` is not implemented yet — there is no
`packages/devtools` in the repo. This is a later-phase package (PLAN.md
§11, Phase 6); the description below is the planned scope, not current
functionality.
:::

## Planned scope

- A local override mechanism — query param, `localStorage`, or env var —
  that forces a flag value regardless of what the provider returns. Intended
  for QA and E2E tests.
- Overrides are meant to compose with `EvaluatedFlag.reason`: when a devtools
  override is active, `reason` becomes `'override'`, the same value used
  today when remote state explicitly sets `enabled`. See
  [Core API Reference](/docs/api/core/) for the full `EvaluationReason`
  union.
