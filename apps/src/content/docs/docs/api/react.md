---
title: React API Reference
description: FlagProvider, useFlag, useVariant, and FlagsContext types.
sidebar:
  order: 2
---

Hand-written reference for everything `@useoptimus/react` exports today
(`packages/react/src/index.ts`). See the [React adapter guide](/docs/adapters/react/overview/)
for usage and the snapshot-vs-live mode contract.

## Components

### `FlagProvider`

```tsx
interface FlagProviderProps {
  client: FlagsClient;
  snapshot?: SerializedSnapshot;
  context?: EvaluationContext;
  children: ReactNode;
}

function FlagProvider(props: FlagProviderProps): ReactElement;
```

`client` is caller-owned — `FlagProvider` never calls `client.init()` or
`client.dispose()` on it. Passing `snapshot` starts the provider in snapshot
mode; passing a `context` whose fields differ from the previous render's
flips it to live mode via `client.setContext()`. See
[Snapshot vs. live mode](/docs/adapters/react/overview/#snapshot-vs-live-mode).

## Hooks

### `useFlag(key, context?)`

```ts
function useFlag<T = boolean>(key: string, context?: EvaluationContext): EvaluatedFlag<T>;
```

Must be called within a `<FlagProvider>` — throws otherwise. Built on
`useSyncExternalStore`: in live mode it reads via `client.evaluate()` and
subscribes to `client.subscribe()` for that key; in snapshot mode it reads
`key` out of the hydrated snapshot with no client calls, throwing if `key`
isn't present in the snapshot. `context` is ignored in snapshot mode.

### `useVariant(key, context?)`

```ts
function useVariant(key: string, context?: EvaluationContext): string | undefined;
```

Shorthand for `useFlag(key, context).variantKey`. Returns `undefined` — never
throws, never casts `.value` to a string — when the flag has no
`variantKey`, e.g. it fell through to `defaultValue` with no bucketing key
resolvable. That's a normal, non-buggy state.

## Context

### `FlagsContext` / `useFlagsContext`

```ts
type FlagsContextValue =
  | { mode: "snapshot"; client: FlagsClient; snapshot: Record<string, EvaluatedFlag<unknown>> }
  | { mode: "live"; client: FlagsClient };

const FlagsContext: React.Context<FlagsContextValue | null>;
function useFlagsContext(): FlagsContextValue;
```

`useFlagsContext()` is what `useFlag`/`useVariant` call internally; exported
for building custom hooks on top of the same provider without duplicating
the "must be inside `<FlagProvider>`" check.

`FlagsClient`, `EvaluationContext`, and `EvaluatedFlag<T>` come from
[`@useoptimus/core`](/docs/api/core/); `SerializedSnapshot` comes from
[`@useoptimus/node`](/docs/api/node/).
