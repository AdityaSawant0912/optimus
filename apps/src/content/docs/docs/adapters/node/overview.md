---
title: Node / SSR Adapter
description: Server-side evaluation and snapshot serialization for SSR hydration.
sidebar:
  order: 1
---

`@useoptimus/node` provides SSR + Node helpers: build an `EvaluationContext`
from an incoming request, and serialize/hydrate an evaluated-flags snapshot
for the server-evaluates-once, client-hydrates-without-re-evaluating
contract.

## Install

```bash
npm install @useoptimus/node
```

## The SSR contract

This adapter implements a contract that's already locked in at the core
level: the server evaluates flags **once**, and the client **hydrates from
that snapshot** — it does not re-evaluate on mount. Re-evaluation only
happens on an explicit context change (e.g. login) or the next server
round-trip. `evaluate()` in `@useoptimus/core` is pure and deterministic
specifically so a server-produced `EvaluatedFlag` and a client-hydrated one
are guaranteed identical for the same inputs.

## `buildContextFromRequest` — zero built-in guessing

Every `EvaluationContext` field is populated only via a caller-supplied
extractor — there's no default header/cookie naming convention. Guessing
one (e.g. assuming an `x-user-id` header) would be wrong for most real apps
and would corrupt bucket assignment silently, which is worse than the helper
doing nothing until configured — the same stance `@useoptimus/core` takes on
the bucketing key itself.

```ts
import { buildContextFromRequest, getHeader, getCookie } from "@useoptimus/node";

const context = buildContextFromRequest(req, {
  userId: (r) => getHeader(r, "x-user-id"),
  sessionId: (r) => getCookie(r, "sessionId"),
  environment: process.env.NODE_ENV,
});
```

`RequestLike` is a hand-rolled structural type (`NodeHeaders | WebHeaders`)
— a real Node/Express/Fastify request, a Next.js App Router `Request`, or a
test double all satisfy it without this package importing any of those
frameworks. `getHeader`/`getCookie` are exported standalone for building
your own extractors.

## `serializeSnapshot` / `hydrateSnapshot`

```ts
import { serializeSnapshot, hydrateSnapshot } from "@useoptimus/node";

// server:
const snapshot = serializeSnapshot(client.evaluateAll(context));
// embed `snapshot` (JSON-safe) in the initial HTML/JSON payload

// client:
const evaluated = hydrateSnapshot(snapshot); // no re-evaluation — see below
```

`hydrateSnapshot` takes **only** the snapshot — no `FlagDefinition[]`, no
provider, no context — so re-evaluation is structurally impossible, not
just conventionally avoided.

`serializeSnapshot` strips `variantKey`/`ruleMatched` to omitted keys when
absent, so the snapshot is JSON-safe by construction, not just after a
`JSON.stringify` round-trip strips them. `hydrateSnapshot` throws on a
`version` mismatch rather than hydrating leniently, consistent with
`FlagsClient.evaluate()` throwing on an unregistered key — a version bump
means the shape may have changed, and silently hydrating stale-shaped data
risks a wrong result with no error.

## Using it with `@useoptimus/react`

Pass the serialized snapshot straight to `<FlagProvider>` — see the
[React adapter](/docs/adapters/react/overview/) for the snapshot-vs-live
mode split this enables.

## Testing

```bash
pnpm --filter @useoptimus/node test
```

See `examples/node-ssr` for a full server-evaluate-then-client-hydrate
example, including the CI-wired parity test.
