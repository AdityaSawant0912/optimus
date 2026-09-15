# @useoptimus/core

## 1.0.0

### Major Changes

- a98d8a2: Fix `enabled: false` being a no-op for boolean flags whose `defaultValue` is
  `true`. Previously, `evaluate()` treated `resolved.enabled === false` as
  "fall back to `defaultValue`" for every `valueType`, which meant a boolean
  flag with `defaultValue: true` could never be forced off remotely —
  `enabled: false` and leaving `enabled` unset were indistinguishable. This
  made `defineKillSwitch`/`defineCircuitBreaker` unusable as a real remote
  off-switch for that (common) default-on shape.
  
  `enabled` is now a real bidirectional override for `valueType: "boolean"`:
  `enabled: true` forces the literal `true`, `enabled: false` forces the
  literal `false`, and omitting `enabled` leaves rollout/targeting/
  `defaultValue` in control, same as before. An explicit `enabled: false`
  still wins over `rolloutPercentage`/`targetingRules`.
  
  **Breaking**: this is a runtime behavior change, not a type change (see
  `VERSIONING.md`) — any boolean flag with `defaultValue: true` that was
  relying on `enabled: false` being ignored will now actually turn off.
  `variant`/`value` flags are unaffected; `enabled: false` still falls back to
  `defaultValue` for those, with `valueOverride`/`variantOverrides` handling
  explicit control.
