# docs-site

Marketing homepage (`/`) + Starlight docs (`/docs`) for YourLib, built with Astro.

## Structure

```
src/
├── pages/
│   └── index.astro              ← custom homepage, fully hand-built
├── components/
│   └── BucketDemo.tsx            ← React island, homepage's interactive signature element
├── content/
│   └── docs/
│       └── docs/                 ← ⚠ note the double "docs" — see below
│           ├── index.mdx
│           ├── getting-started/
│           ├── concepts/
│           ├── adapters/
│           │   ├── react/
│           │   ├── angular/
│           │   ├── node/
│           │   └── devtools/
│           └── api/
├── content.config.ts             ← wires the docs loader/schema for Starlight
└── styles/
    └── global.css                ← design tokens (colors, fonts) for the homepage
astro.config.mjs                  ← Starlight sidebar config lives here
```

## Why the nested `content/docs/docs/` folder

Starlight's `base` config option was removed post-0.39. The current supported
way to keep Starlight off the site root — so a custom homepage can live at
`/` — is to nest all doc content one level deeper, inside an extra `docs/`
folder under `src/content/docs/`. Starlight then serves every page under
`/docs/*` automatically, and `src/pages/index.astro` is free to be whatever
you want. See the ["Use Starlight at a subpath"](https://starlight.astro.build/manual-setup/#use-starlight-at-a-subpath)
guide if this changes in a future Starlight release.

**Practical effect for whoever (agent or human) is writing docs:** every new
doc page goes under `src/content/docs/docs/...`, not `src/content/docs/...`.

## Doc-writing convention

Every file needs frontmatter with at minimum `title` and `description`
(Starlight uses these for page `<title>`, SEO meta, and — combined with
`sidebar.order` — nav ordering). Example:

```md
---
title: Installation
description: Install the core package and the adapter for your framework.
sidebar:
  order: 1
---
```

Sidebar groups are defined explicitly in `astro.config.mjs` (mirroring the
`packages/` layout: core, react, angular, node, devtools) rather than one
big autogenerate off the root — this keeps the nav order intentional instead
of alphabetical-by-folder. Within each section, `autogenerate` still handles
individual page ordering via `sidebar.order` in frontmatter, so an agent
dropping new files into an existing section doesn't require a config edit —
only adding a whole new top-level section does.

## Generating API reference from source (not yet wired up)

The `docs/api/` pages are currently hand-written placeholders. To generate
them from actual TSDoc comments instead:

1. `npm install -D typedoc typedoc-plugin-markdown` in the library repo (not
   this docs-site repo).
2. Run `typedoc --plugin typedoc-plugin-markdown --out ../docs-site/src/content/docs/docs/api/generated .`
   as a build step (e.g. in the library's CI, before this site builds).
3. Add frontmatter to TypeDoc's output — either via TypeDoc's
   `--frontmatterGlobals` option or a small post-process script — since raw
   TypeDoc markdown won't have Starlight's required `title`/`description`
   fields by default.

## Local development

```bash
npm install
npm run dev        # localhost:4321, homepage at /, docs at /docs
npm run build       # outputs to dist/
```

## Deploying

Zero-config on Vercel: connect the repo, framework preset auto-detects
Astro, no adapter needed for a static build (`output: 'static'`, the
current default — switch to the Vercel adapter only if a page later needs
SSR).
