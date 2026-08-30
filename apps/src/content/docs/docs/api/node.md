---
title: Node API Reference
description: buildContextFromRequest, serializeSnapshot, and hydrateSnapshot.
sidebar:
  order: 4
---

Hand-written reference for everything `@useoptimus/node` exports today
(`packages/node/src/index.ts`). See the [Node / SSR adapter guide](/docs/adapters/node/overview/)
for the SSR contract this package implements.

## Request context

### `buildContextFromRequest(req, options?)`

```ts
interface BuildContextFromRequestOptions {
  bucketingKey?: (req: RequestLike) => string | undefined;
  userId?: (req: RequestLike) => string | undefined;
  deviceId?: (req: RequestLike) => string | undefined;
  sessionId?: (req: RequestLike) => string | undefined;
  anonymousId?: (req: RequestLike) => string | undefined;
  attributes?: (req: RequestLike) => Record<string, string | number | boolean>;
  environment?: string | ((req: RequestLike) => string);
}

function buildContextFromRequest(
  req: RequestLike,
  options?: BuildContextFromRequestOptions,
): EvaluationContext;
```

Every field is populated only via a caller-supplied extractor — zero
built-in header/cookie guessing. A field is omitted from the returned
`EvaluationContext` entirely when its extractor is absent or returns
`undefined`, rather than being set to `undefined`.

### `getHeader(req, name)` / `getCookie(req, name)`

```ts
function getHeader(req: RequestLike, name: string): string | undefined;
function getCookie(req: RequestLike, name: string): string | undefined;
```

Standalone helpers for building your own extractors. `getHeader` accepts
either a Node-style header object (`Record<string, string | string[] | undefined>`,
matched case-insensitively) or a Web-standard `Headers`-like object (anything
with a `.get()` method) via `RequestLike`; a multi-value Node header is
joined with `", "`.

### `RequestLike` / `NodeHeaders` / `WebHeaders`

```ts
interface RequestLike {
  headers: NodeHeaders | WebHeaders;
}
type NodeHeaderValue = string | string[] | undefined;
interface NodeHeaders {
  [name: string]: NodeHeaderValue;
}
interface WebHeaders {
  get(name: string): string | null;
}
```

A hand-rolled structural type — a real Node/Express/Fastify request, a
Next.js App Router `Request`, or a test double all satisfy it without this
package importing any of those frameworks.

## Snapshot serialization

### `serializeSnapshot(evaluated, now?)`

```ts
function serializeSnapshot(
  evaluated: Record<string, EvaluatedFlag<unknown>>,
  now?: () => number, // default Date.now
): SerializedSnapshot;
```

Typically called with `client.evaluateAll(context)`'s return value. Strips
`variantKey`/`ruleMatched` to omitted keys when absent, making the result
JSON-safe by construction rather than by accident.

### `hydrateSnapshot(snapshot)`

```ts
function hydrateSnapshot(snapshot: SerializedSnapshot): Record<string, EvaluatedFlag<unknown>>;
```

Takes **only** the snapshot — no `FlagDefinition[]`, no provider, no
context — so client-side re-evaluation is structurally impossible, not just
conventionally avoided. Throws if `snapshot.version` doesn't match the
current `SNAPSHOT_VERSION`.

### `SerializedSnapshot` / `SNAPSHOT_VERSION`

```ts
const SNAPSHOT_VERSION = 1;

interface SerializedSnapshot {
  version: typeof SNAPSHOT_VERSION;
  generatedAt: number; // ms epoch
  flags: Record<string, EvaluatedFlag<unknown>>;
}
```

`EvaluatedFlag<T>` and `EvaluationContext` come from
[`@useoptimus/core`](/docs/api/core/). Pass a `SerializedSnapshot` straight
to `@useoptimus/react`'s [`<FlagProvider snapshot={...}>`](/docs/api/react/)
or `@useoptimus/angular`'s [`provideFeatureFlags(client, snapshot)`](/docs/api/angular/).
