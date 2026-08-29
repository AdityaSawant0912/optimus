---
title: State Providers
description: Wiring HttpPollingProvider and SseProvider for real remote flag state, plus caching with TtlFlagStateCache.
sidebar:
  order: 3
---

[Quick Start](/docs/getting-started/quick-start/) uses `LocalProvider` — a
static in-memory array, good for tests and local dev. This page covers the
two providers that actually talk to a network:
`HttpPollingProvider` and `SseProvider`, both exported from
`@useoptimus/core`. Everything on this page is real, implemented code — no
third-party integration (LaunchDarkly, Split, Flagsmith) exists in this
library yet; that's an explicitly deferred, not-yet-built idea.

## The `FlagProvider` interface

Every provider — including ones you write yourself — implements the same
small interface:

```ts
interface FlagProvider {
  name: string;
  init(): Promise<void>;
  getRemoteState(keys?: string[]): Promise<FlagRemoteState[]>;
  subscribe?(onUpdate: (state: FlagRemoteState[]) => void): () => void;
}
```

`subscribe` is optional because not every provider is push-based:
`HttpPollingProvider` implements it (it's how the poll loop starts);
`LocalProvider` doesn't implement it at all, since a static array never
changes on its own. `FlagsClient.init()` calls `provider.init()`, then
`refresh()` (one `getRemoteState()` call), then wires `subscribe` if the
provider has one — see [`FlagsClient`](/docs/api/core/#flagsclient).

## `LocalProvider`

Already covered in [Quick Start](/docs/getting-started/quick-start/#fetch-remote-state-from-a-provider) —
reach for it for tests and local dev, not production traffic.

## `HttpPollingProvider`

Polls a single URL on an interval. The endpoint must return either a bare
`FlagRemoteState[]` array or a `{ flags: FlagRemoteState[] }` envelope.

```ts
import { FlagsClient, HttpPollingProvider } from '@useoptimus/core';

const provider = new HttpPollingProvider({
  url: 'https://flags.example.com/api/state',
  intervalMs: 15_000, // default is 30_000
  headers: { Authorization: `Bearer ${apiToken}` },
});

const client = new FlagsClient({
  definitions: [showNewNav, checkoutExperiment],
  provider,
});

await client.init(); // resolves fetchImpl, does the first fetch, starts polling
client.evaluate('show-new-nav', { userId: 'user_123' });

const unsubscribe = client.subscribe((changedKeys) => {
  console.log('flags updated from a poll:', changedKeys);
});
```

`init()` only resolves the fetch implementation (global `fetch`, or a
`fetchImpl` you pass in — useful in a Node runtime without a global
`fetch`, or to inject a test double); the first real network call happens
inside `client.init()`'s own `refresh()`, so there's no duplicate initial
request.

### Failure handling in practice

A poll can fail (network error, non-2xx status, malformed body). Each
failure schedules the next retry with **Equal Jitter exponential backoff**
— 50%–100% of the doubling delay, capped at 5 minutes — instead of hammering
a degraded endpoint on a fixed interval. What a caller actually sees during
an outage depends on the flag's `failureMode`:

```ts
const maintenanceMode = defineKillSwitch({
  key: 'maintenance-mode',
  defaultValue: false,
  // failureMode: 'closed' is the default from defineKillSwitch — falls
  // back to defaultValue (false) if the provider has never successfully
  // fetched this key.
});

const legacyCheckoutFallback: FlagDefinition<boolean> = {
  key: 'legacy-checkout-fallback',
  kind: 'circuitBreaker',
  valueType: 'boolean',
  defaultValue: false,
  failureMode: 'open', // fails OPEN: value becomes true on a fetch failure,
  sticky: false,        // not defaultValue — this flag gates a safety net,
  emitsExposure: false, // so "provider is down" should enable it, not disable it.
};
```

- **`'closed'`** (most flags): on failure with no prior successful fetch,
  falls back to `defaultValue`, `reason: 'fallbackError'`.
- **`'open'`**: a `boolean` flag flips to `true` on failure instead of
  falling back — for flags gating a fail-safe path.
- **`'lastKnown'`**: if a previous poll already succeeded, keeps evaluating
  against that cached remote state (`stale: true`) rather than falling
  back — useful when "slightly outdated" beats "reverts to default."

## `SseProvider`

Push-based: opens an `EventSource` connection and updates from server-sent
messages instead of polling.

**Browser** (native `EventSource`, no extra config):

```ts
import { FlagsClient, SseProvider } from '@useoptimus/core';

const client = new FlagsClient({
  definitions: [showNewNav],
  provider: new SseProvider({ url: 'https://flags.example.com/api/stream' }),
});

await client.init();
```

**Node** (no global `EventSource` — pass a factory, e.g. wrapping the
[`eventsource`](https://www.npmjs.com/package/eventsource) npm package):

```ts
import { SseProvider } from '@useoptimus/core';
import EventSource from 'eventsource';

const provider = new SseProvider({
  url: 'https://flags.example.com/api/stream',
  eventSourceFactory: () => new EventSource('https://flags.example.com/api/stream'),
});
```

Each pushed message must be a JSON-encoded `FlagRemoteState[]` (or `{ flags:
[...] }` envelope) — same shape `HttpPollingProvider` expects back from its
URL. A malformed message is dropped silently; the connection stays open.

**One consequence to design around**: `getRemoteState()` on `SseProvider`
never performs a network fetch — it returns whatever was last pushed, `[]`
before the first message arrives. Since `FlagsClient.init()` calls
`refresh()` (one `getRemoteState()`) *before* `subscribe()` opens the
connection, an `SseProvider`-only client's very first `refresh()` always
sees `[]`. In practice this means: every flag evaluates against its code
`defaultValue` until the first push lands, then updates live from there.
If you need correct values immediately on load, seed from an initial
`HttpPollingProvider` fetch or an SSR-hydrated snapshot rather than relying
on `SseProvider` alone for the first paint.

Reconnection is not reimplemented here — both the browser's native
`EventSource` and the `eventsource` npm package already auto-reconnect per
the SSE spec, so a second reconnect loop on top would just race the
transport's own retry timer.

## Caching with `TtlFlagStateCache`

The default cache `FlagsClient` uses is a plain in-memory `Map` — `get()`/
`set()` with no TTL concept at all. `TtlFlagStateCache` adds staleness
*notification* on top, without changing what `evaluate()`/`evaluateAll()`
return by itself:

```ts
import { FlagsClient, HttpPollingProvider, TtlFlagStateCache, wireAutoRevalidation } from '@useoptimus/core';

const cache = new TtlFlagStateCache({
  ttlMs: 30_000,             // default
  staleWhileRevalidateMs: 300_000, // default
});

const client = new FlagsClient({
  definitions: [showNewNav],
  provider: new HttpPollingProvider({ url: 'https://flags.example.com/api/state' }),
  cache,
});

// Wires cache staleness -> client.refresh([key]) automatically, batching
// keys that go stale in the same tick into one refresh call.
const stopAutoRevalidation = wireAutoRevalidation(cache, client);

await client.init();
```

Use `cache.isStale(key)` / `cache.getStaleness(key)` (`'fresh' | 'stale' |
'unknown'`) for introspection — e.g. surfacing "data may be outdated" in a
debug UI — independent of whether you've wired auto-revalidation.

## Choosing a provider

- **`LocalProvider`** — tests, storybook, local dev without a real backend.
- **`HttpPollingProvider`** — simplest production option; works behind any
  plain HTTP endpoint, including one fronted by a CDN/cache. Update latency
  is bounded by `intervalMs`.
- **`SseProvider`** — lower-latency updates (near-immediate on push) at the
  cost of a long-lived connection and the cold-start caveat above; needs a
  server that can hold open SSE streams.

Nothing stops combining them (e.g. `HttpPollingProvider` for the initial
correct state, a separate mechanism for push) — `FlagsClient` only takes
one `provider`, so that would mean writing a small custom `FlagProvider`
that composes two others; not something this library ships for you.
