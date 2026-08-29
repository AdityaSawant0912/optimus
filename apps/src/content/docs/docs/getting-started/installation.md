---
title: Installation
description: Install the core evaluation engine — the only package published so far.
sidebar:
  order: 1
---

## Install core

```bash
npm install @feature-flags/core
```

`@feature-flags/core` is a pure TypeScript evaluation engine with zero
framework dependencies. It runs identically in Node, the browser, and any
SSR environment.

:::caution
Only `@feature-flags/core` exists right now. The React, Angular, Node/SSR,
and DevTools adapters described in [Adapters](/docs/adapters/react/overview/)
are planned but not yet implemented — see each adapter page for status.
:::

## Adapters (planned)

Once shipped, the framework adapters will install alongside core, matching
your framework:

```bash
npm install @feature-flags/react     # React
npm install @feature-flags/angular   # Angular
npm install @feature-flags/node      # Node / SSR
```
