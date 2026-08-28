
# Feature Flags Library — Project Plan

> **Purpose of this doc:** This is a design/planning spec for a standalone TypeScript
> feature-flag library, intended to be handed to a Claude Code session to begin
> implementation. It captures the product decisions already made, the architecture,
> the core type shapes, open questions, and a phased build plan. Treat the
> "Decisions Log" as binding constraints — don't silently revisit them without
> flagging the tradeoff to the user first.

---

## 1. Goals

Build a standalone TS library for feature flags that:

- Works in **frontend (React, Angular)** and **backend (Node)**, same core engine.
- Supports **SSR** — server evaluates once, client hydrates from a snapshot (no
  re-evaluation, no flicker).
- Supports a **hybrid flag-definition model**: flags are declared in code
  (type-safe schema) but their live *state* (enabled/rollout/targeting) can be
  updated remotely without a deploy.
- Ships with **consistent, salted bucketing** for percentage rollouts and A/B
  tests, with sane defaults but user-overridable identity resolution.
- Is provider-agnostic: local JSON, remote HTTP polling, SSE/WebSocket push, or
  a passthrough to a third-party flag service (LaunchDarkly, Split, Flagsmith),
  all behind one interface.

## 2. Non-goals (v1)

- **Identity aliasing** (anonymous → identified user re-bucketing) is explicitly
  **out of scope for v1**. Document this limitation clearly; don't silently
  half-implement it.
- No built-in analytics/event pipeline — the library exposes hooks
  (`onEvaluate`), it doesn't ship a tracking SDK.
- No hosted backend/dashboard in v1 — this is a library, not a SaaS product.
  (A remote provider can point at a self-hosted or third-party service.)

---

## 3. Flag Taxonomy

Flags are modeled as **3 primitive shapes** + **behavioral traits**, not a flat
enum of unrelated "kinds." This keeps the type system extensible as new flag
"types" get requested later — they're usually just a new combination of trait
values, not a wholly new code path.

### 3.1 Primitive value shapes

| Shape       | Description                                  | Example                         |
| ----------- | -------------------------------------------- | ------------------------------- |
| `boolean` | On/off                                       | release flag, kill switch       |
| `variant` | One of N named variants, weighted            | A/B/C test                      |
| `value`   | Arbitrary typed payload (string/number/JSON) | dynamic config, "max page size" |

### 3.2 Behavioral traits (composable, layered on top of a primitive shape)

| Trait                                            | What it changes                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `failureMode: 'closed' \| 'open' \| 'lastKnown'` | What happens if the provider is unreachable. Kill switches default to`closed` (fail safe = off).                 |
| `rollout`                                      | Percentage-based bucketing config (uses the bucketing engine, §5)                                                 |
| `targetingRules`                               | Attribute-based rule matching (see §6)                                                                            |
| `sticky: boolean`                              | Whether the same bucketing key always resolves to the same result                                                  |
| `emitsExposure: boolean`                       | Whether reading this flag should fire an`onEvaluate` event (true for A/B tests, usually false for kill switches) |
| `schedule`                                     | Optional`{ startAt, endAt }` time window                                                                         |
| `dependsOn`                                    | Optional parent flag key(s) — this flag only evaluates if parent is truthy                                        |

### 3.3 Named flag "kinds" (convenience presets over the above)

These are just pre-configured trait bundles exposed as ergonomic helpers /
schema shortcuts — not separate runtime engines.

- **Release flag** — `boolean`, `failureMode: 'closed'`, no rollout by default.
- **Kill switch** — `boolean`, `failureMode: 'closed'`, high-priority/audit-logged,
  intended to be flipped fast and manually.
- **A/B Test (Experiment)** — `variant`, `sticky: true`, `emitsExposure: true`,
  rollout = variant weights.
- **Safer Refactor (migration flag)** — `boolean` or `value`, rollout %,
  optional shadow-mode comparison hook (`onShadowResult(oldResult, newResult)`).
- **Progressive Deploy (ring/wave rollout)** — `boolean`, rollout % with named
  "rings" (internal → beta → 10% → 50% → 100%), `sticky: true`.
- **Entitlement flag** — `boolean`, targeting-rules-driven (plan tier/org/role),
  no random rollout.
- **Ops / circuit breaker** — `boolean`, `failureMode: 'closed'`, intended to be
  flipped programmatically (e.g. by a monitoring system), not via UI.
- **Dynamic config** — `value`, targeting-rules-driven, no boolean semantics at all.
- **Scheduled flag** — any shape + `schedule` trait.

Implementation note: v1 should ship boolean, variant, and value as the real
primitives, and implement "kinds" as factory functions / schema sugar
(`defineKillSwitch(...)`, `defineExperiment(...)`) that produce a
`FlagDefinition` with the right trait defaults pre-filled. Don't build 8
parallel evaluation code paths.

---

## 4. Architecture

### 4.1 Package layout (proposed)

```
feature-flags/
├── packages/
│   ├── core/              # pure TS engine, zero framework deps
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── engine.ts          # evaluate(definition, context) -> EvaluatedFlag
│   │   │   ├── bucketing.ts       # hashing / consistent bucketing
│   │   │   ├── targeting.ts       # rule matching engine
│   │   │   ├── providers/
│   │   │   │   ├── provider.ts    # FlagProvider interface
│   │   │   │   ├── local.ts       # static/local JSON provider
│   │   │   │   ├── http-polling.ts
│   │   │   │   └── sse.ts
│   │   │   ├── cache.ts           # TTL + stale-while-revalidate
│   │   │   └── index.ts
│   │   └── package.json
│   ├── react/              # useFlag, useVariant, <FlagProvider>
│   ├── angular/             # FeatureFlagService, *ifFeature directive
│   ├── node/                # server/request-context helpers, SSR snapshot serializer
│   └── devtools/            # local override panel, query-param/localStorage overrides
├── examples/
│   ├── react-app/
│   ├── angular-app/
│   └── node-ssr/
├── docs/
└── PLAN.md                 # this file
```

Rationale: `core` has zero framework dependencies so it can run identically in
browser, Node/SSR, Angular, React, or a Cloudflare Worker. Framework packages
are thin adapters that call into `core`.

### 4.2 Data flow

```
Code-defined FlagDefinition[]  ──┐
                                  ├──> Registry (merges schema + remote state)
Remote Provider (live state)  ───┘              │
                                                  ▼
                              EvaluationContext (bucketing key, attributes, env)
                                                  │
                                                  ▼
                                          Evaluation Engine
                                     (bucketing + targeting + traits)
                                                  │
                                                  ▼
                                          EvaluatedFlag<T>
                                     (value, variant, reason, metadata)
                                                  │
                              ┌───────────────────┼────────────────────┐
                              ▼                   ▼                    ▼
                        React hook          Angular service      SSR snapshot
                        (useFlag)           (flag$ observable)   (serialize all,
                                                                  hydrate client)
```

### 4.3 SSR flow specifically

1. Server builds `EvaluationContext` from the request (headers, cookies, auth,
   org id — **not** `window`/`localStorage`, which don't exist server-side).
2. Server evaluates all flags needed for the page once.
3. Server serializes the result to a flat `{ [flagKey]: EvaluatedFlag }` snapshot
   and embeds it in the initial payload (e.g. alongside other SSR state).
4. Client hydrates from that snapshot — it does **not** re-evaluate on mount.
   Re-evaluation only happens on context change (e.g. user logs in) or on the
   next server round-trip.
5. Consequence: the `core` engine must be side-effect-free and deterministic —
   same `(definition, context)` in ⇒ same `EvaluatedFlag` out, always. No hidden
   reliance on browser globals inside `core`; only adapters may touch those.

### 4.4 Remote value merge behavior

- Code schema defines: `key`, value `type`, `defaultValue`, `kind`,
  `description`, `owners`.
- Remote provider supplies: `enabled`, `rolloutPercentage`, `variants`,
  `targetingRules`, `value` overrides.
- Merge rule: remote state **overrides** schema defaults field-by-field: if the
  remote provider is unreachable or a field is missing, fall back to the
  code-defined default for that field.
- This fallback-to-code-default behavior **is** the kill-switch fail-safe
  mechanism — no separate failure-handling code path needed, just correct
  defaults per flag `kind`.

---

## 5. Bucketing (percentage rollout / A-B assignment)

### Decisions locked in:

- **Default identity resolution chain** (used unless the caller overrides it):
  `userId → deviceId → sessionId → anonymousId` — first non-null wins.
- **Bucketing key is explicit in the context type**, not inferred by guessing
  which field "looks like" an ID:
  ```ts
  interface EvaluationContext {
    bucketingKey?: string; // if omitted, resolver chain below is used
    userId?: string;
    deviceId?: string;
    sessionId?: string;
    anonymousId?: string;
    attributes?: Record<string, string | number | boolean>;
    environment?: string;
  }
  ```
- **Mandatory internal salting** — the library always composes the final hash
  input itself; callers never need to remember to salt:
  ```
  hashInput = `${resolvedBucketingKey}:${flagKey}${bucketingSeed ? ':' + bucketingSeed : ''}`
  bucketValue = hash(hashInput) % 10000   // 0.01% resolution
  ```

  This prevents correlated bucket membership across unrelated flags (a user
  landing in "top 10%" for every experiment simultaneously), which would bias
  A/B results.
- **`bucketingSeed`** is optional per-flag metadata, used to intentionally
  re-randomize an experiment's bucket assignments on relaunch without changing
  the flag key.
- **Hash function**: use a fast, well-distributed, non-cryptographic hash
  (e.g. FNV-1a or MurmurHash3) — no need for crypto-grade hashing, just good
  distribution and determinism across JS engines (must match on Node and
  browser V8 identically).

### Explicitly out of scope (v1):

- **Identity aliasing.** If a user is bucketed anonymously pre-login and then
  authenticates, they may land in a different bucket post-login because the
  resolved bucketing key changed. Document this prominently in the README and
  in the `EvaluationContext` JSDoc. Do not attempt a partial workaround.

---

## 6. Targeting Rules Engine

One rule-matching engine powers rollout %, A/B bucketing, and entitlement
checks — don't build separate systems for each.

Proposed rule shape:

```ts
type TargetingRule =
  | { type: 'attributeEquals'; attribute: string; value: string | number | boolean }
  | { type: 'attributeIn'; attribute: string; values: (string | number)[] }
  | { type: 'percentageRollout'; percentage: number; bucketingSeed?: string }
  | { type: 'semverRange'; attribute: string; range: string }
  | { type: 'dateRange'; startAt?: string; endAt?: string }
  | { type: 'and'; rules: TargetingRule[] }
  | { type: 'or'; rules: TargetingRule[] };
```

Rules are evaluated in order; first full match determines the outcome
(standard "rule list" semantics, same mental model as most flag SaaS tools).

---

## 7. Core Type Sketches

These are the four foundational types everything else depends on. (Draft for
Claude Code to refine, not final.)

```ts
// ---- Flag definition (code-defined schema) ----
interface FlagDefinition<T = boolean> {
  key: string;
  kind: 'release' | 'killSwitch' | 'experiment' | 'migration' | 'progressiveDeploy'
      | 'entitlement' | 'circuitBreaker' | 'dynamicConfig' | 'custom';
  valueType: 'boolean' | 'variant' | 'value';
  defaultValue: T;
  variants?: { key: string; value: T; weight: number }[]; // for variant shape
  failureMode: 'closed' | 'open' | 'lastKnown';
  sticky: boolean;
  emitsExposure: boolean;
  dependsOn?: string[];
  schedule?: { startAt?: string; endAt?: string };
  description?: string;
  owners?: string[];
}

// ---- Live/remote state (overrides parts of the definition) ----
interface FlagRemoteState {
  key: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  bucketingSeed?: string;
  targetingRules?: TargetingRule[];
  variantOverrides?: { key: string; weight: number }[];
  valueOverride?: unknown;
  updatedAt: string;
}

// ---- Evaluation context ----
interface EvaluationContext {
  bucketingKey?: string;
  userId?: string;
  deviceId?: string;
  sessionId?: string;
  anonymousId?: string;
  attributes?: Record<string, string | number | boolean>;
  environment?: string;
}

// ---- Result returned to consumers ----
interface EvaluatedFlag<T = boolean> {
  key: string;
  value: T;
  variantKey?: string;
  reason: 'default' | 'targetingMatch' | 'rollout' | 'override' | 'fallbackError' | 'dependencyNotMet';
  ruleMatched?: string;
  stale: boolean; // true if served from cache past soft-TTL
}

// ---- Provider interface ----
interface FlagProvider {
  name: string;
  init(): Promise<void>;
  getRemoteState(keys?: string[]): Promise<FlagRemoteState[]>;
  subscribe?(onUpdate: (state: FlagRemoteState[]) => void): () => void; // for SSE/WS
}
```

---

## 8. Framework Adapters

### React (`packages/react`)

- `<FlagProvider client={flagsClient} snapshot={ssrSnapshot}>` — context provider,
  accepts an SSR snapshot to hydrate from.
- `useFlag<T>(key: string): EvaluatedFlag<T>`
- `useVariant(key: string): string` — sugar over `useFlag` for experiments.
- Suspense-compatible variant for cases where flags must be resolved before
  render (optional, phase 2).

### Angular (`packages/angular`)

- `FeatureFlagService` — injectable, RxJS-based: `flag$(key): Observable<EvaluatedFlag<T>>`.
- `*ifFeature="'flag-key'"` structural directive for template conditionals.
- Standalone-component friendly (no NgModule requirement) since that's the
  modern Angular default.

### Node / Backend (`packages/node`)

- `buildContextFromRequest(req): EvaluationContext` helper (framework-agnostic,
  works with Express/Fastify/Next request objects via a thin adapter).
- `serializeSnapshot(evaluatedFlags): SerializedSnapshot` for SSR hydration.
- Same `core` client, just instantiated server-side with a context built from
  request data instead of `window`.

### Devtools (`packages/devtools`, later phase)

- Local override mechanism: query param / localStorage / env var forces a flag
  value regardless of provider — needed for QA and E2E tests.
- Should compose cleanly with the "reason" field in `EvaluatedFlag` (reason
  becomes `'override'` when a devtools override is active).

---

## 9. Decisions Log (do not silently revisit)

| # | Decision                                                                                                               | Status |
| - | ---------------------------------------------------------------------------------------------------------------------- | ------ |
| 1 | Hybrid flag definitions: code schema + remotely-updatable state                                                        | Locked |
| 2 | SSR: evaluate once server-side, client hydrates from snapshot, no client re-evaluation on mount                        | Locked |
| 3 | Bucketing key is user-configurable, with a default resolver chain (`userId → deviceId → sessionId → anonymousId`) | Locked |
| 4 | Library always internally salts hash input as`bucketingKey:flagKey[:seed]` — user never hand-rolls salting          | Locked |
| 5 | Identity aliasing (anonymous → identified re-bucketing) is out of scope for v1                                        | Locked |
| 6 | Flags modeled as 3 primitives (boolean/variant/value) + composable traits, not N parallel flag-type engines            | Locked |
| 7 | `core` package has zero framework dependencies                                                                       | Locked |

## 10. Open Questions (resolve before/during Phase 1)

- Hash function choice: FNV-1a vs MurmurHash3 vs xxhash — pick based on a JS
  implementation that's dependency-light and has identical output across
  Node/browser.
- Cache staleness policy specifics: TTL default, stale-while-revalidate window
  length, whether `stale: true` in `EvaluatedFlag` should trigger a UI warning
  in devtools.
- Exact shape of the shadow-mode comparison hook for "Safer Refactor" flags —
  sync or async comparator, how results get logged.
- Should `dependsOn` support more than simple truthy-parent checks (e.g.
  "parent must resolve to variant X")? Defer unless there's a concrete need.
- Third-party provider adapters (LaunchDarkly/Split/Flagsmith passthrough) —
  phase 2+, not blocking v1.

---

## 11. Phased Build Plan

### Phase 0 — Scaffolding

- Monorepo setup (pnpm workspaces or Turborepo), `core` package skeleton,
  tsconfig, lint/test tooling, CI.
- No logic yet — just the package layout from §4.1 and empty exports.

### Phase 1 — Core engine (no framework, no remote provider)

- Implement types from §7.
- Implement bucketing engine (§5) with unit tests covering distribution
  uniformity and salting correctness (verify two flags don't correlate).
- Implement targeting rules engine (§6) with unit tests per rule type.
- Implement `evaluate(definition, remoteState, context): EvaluatedFlag`,
  pure and deterministic.
- Implement `local` provider (static in-memory / JSON) — enough to test the
  engine end-to-end without network dependencies.
- **Deliverable**: `core` package fully testable and usable standalone in
  Node, with 90%+ test coverage on bucketing + targeting + evaluation logic.

### Phase 2 — Providers + caching

- HTTP polling provider with configurable interval.
- SSE/WebSocket provider for push updates.
- Cache layer: TTL, stale-while-revalidate, `failureMode` handling
  (closed/open/lastKnown) tested against a simulated provider outage.

### Phase 3 — SSR + Node helpers

- `buildContextFromRequest`, `serializeSnapshot`/hydration helpers.
- Example Node/Express SSR app in `examples/node-ssr`.
- Test: server-evaluated snapshot must produce byte-identical `EvaluatedFlag`
  results to client hydration given the same snapshot (no re-evaluation drift).

### Phase 4 — React adapter

- `<FlagProvider>`, `useFlag`, `useVariant`.
- Example app in `examples/react-app` demonstrating SSR hydration + a live
  A/B test + a kill switch.

### Phase 5 — Angular adapter

- `FeatureFlagService`, `*ifFeature` directive.
- Example app in `examples/angular-app`.

### Phase 6 — Flag "kind" sugar + devtools

- Factory helpers (`defineKillSwitch`, `defineExperiment`, etc.) from §3.3.
- Local override devtools panel + query-param/localStorage override support.

### Phase 7 — Docs + polish

- README per package, top-level architecture doc, migration/versioning policy
  for flag schema changes, contribution guide.

---

## 12. Instructions for the Claude Code Session

- Work **phase by phase**, in order. Don't jump ahead to React/Angular
  adapters before the core engine (Phase 1) has real test coverage — the
  adapters are thin and will be easy to get wrong if the engine underneath
  isn't solid yet.
- Treat §9 (Decisions Log) as fixed constraints. If you hit a case where one
  of them seems wrong, stop and flag it back to the user rather than quietly
  deviating.
- For anything in §10 (Open Questions), pick a reasonable default, implement
  it, and **call out the choice explicitly** in your response/PR description
  so the user can override it later — don't block progress waiting for
  answers to non-blocking questions.
- Prioritize the `core` package being framework-free and fully unit-testable
  in isolation — this is the foundation the whole library's reliability rests
  on.
- Write tests alongside each phase, not after. Bucketing distribution and
  salting-independence tests in particular are easy to get subtly wrong and
  hard to catch by inspection.
- Use TypeScript strict mode across all packages.
- Prefer small, composable functions in `core` over a single monolithic
  `evaluate()` — bucketing, targeting, and merge logic should be independently
  testable units.
