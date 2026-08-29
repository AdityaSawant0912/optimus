# @useoptimus/react

React adapter: `<FlagProvider>`, `useFlag`, `useVariant`.

## Install

```bash
npm install @useoptimus/react
```

Peer dependency: `react@^18.0.0 || ^19.0.0` (floor of 18 because
`useSyncExternalStore`, which `useFlag` is built on, doesn't exist in 17).

## Usage

```tsx
import { FlagProvider, useFlag } from "@useoptimus/react";

function App({ client, snapshot }) {
  return (
    <FlagProvider client={client} snapshot={snapshot}>
      <Banner />
    </FlagProvider>
  );
}

function Banner() {
  const flag = useFlag<boolean>("show-banner");
  return flag.value ? <div>New banner!</div> : null;
}
```

`client` is a `FlagsClient` from `@useoptimus/core`, constructed and
owned entirely by your app — `<FlagProvider>` never calls
`client.init()`/`client.dispose()`. React StrictMode's double-effect-invoke
in dev would break a shared client on the second mount if it did; a client
is also typically one-per-app, not scoped to one component subtree.

## Snapshot vs. live mode

Passing `snapshot` (a `SerializedSnapshot` from `@useoptimus/node`)
puts the provider in **snapshot mode**: `useFlag` reads only from the
hydrated snapshot, with zero calls to `client.evaluate()`/`evaluateAll()`
— the literal, testable expression of the "server evaluates once, client
hydrates without re-evaluating" contract.

The only way out of snapshot mode is an explicit, field-different `context`
prop change:

```tsx
<FlagProvider client={client} snapshot={snapshot} context={{ userId }}>
```

A re-render with a *new object, same fields* does **not** flip to live
mode (an inline `context={{}}` literal is safe); a re-render with an
actually different field does, calling `client.setContext()` once and
switching every subsequent `useFlag` read to live `client.evaluate()`
calls, subscribed to live updates via `client.subscribe()`.

## `useVariant`

```tsx
const variantKey = useVariant("checkout-v2"); // string | undefined
```

Returns `undefined` — never throws, never casts `.value` to a string —
when the flag has no `variantKey` (e.g. it fell through to its default
with no bucketing key resolvable). That's a normal state, not a bug.

## Testing

```bash
pnpm --filter @useoptimus/react test
```
