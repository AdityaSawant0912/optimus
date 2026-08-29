---
title: Installation
description: Install the core package and the adapter for your framework.
sidebar:
  order: 1
---

## Install core

```bash
npm install @useoptimus/core
```

`@useoptimus/core` is a pure TypeScript evaluation engine with zero framework
dependencies. It runs identically in Node, the browser, and any SSR
environment, and is the only required package — every adapter below is a
thin layer on top of it.

## Adapters

Install the adapter that matches your framework alongside core:

```bash
npm install @useoptimus/react     # React — <FlagProvider>, useFlag, useVariant
npm install @useoptimus/angular   # Angular — FeatureFlagService, *ifFeature
npm install @useoptimus/node      # Node / SSR — request context + snapshot hydration
```

## DevTools (optional)

```bash
npm install @useoptimus/devtools --save-dev
```

Local override resolution (query param / `localStorage` / injected global)
and a framework-agnostic debug panel, for forcing flag values during QA/E2E
testing. See the [DevTools adapter](/docs/adapters/devtools/overview/) page.

## Next

[Quick Start](/docs/getting-started/quick-start/) walks through defining and
evaluating your first flag.
