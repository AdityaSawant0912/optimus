// @ts-check
import { defineConfig } from 'astro/config';

import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://optimus.dev', // TODO: replace with real domain before deploying
  integrations: [
    starlight({
      title: 'Optimus',
      // NOTE on the /docs subpath: Starlight no longer exposes a `base`
      // option (removed post-0.39 — see the "Use Starlight at a subpath"
      // guide). The actual mechanism is the extra `docs/` nesting under
      // src/content/docs/docs/ — that folder is what puts every Starlight
      // page at /docs/*, leaving src/pages/index.astro as the real "/".
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/AdityaSawant0912/optimus' },
      ],
      // Sidebar is explicit here (rather than autogenerate) so it mirrors the
      // packages/ layout intentionally instead of just mirroring folder order.
      sidebar: [
        {
          label: 'Getting Started',
          items: [{ autogenerate: { directory: 'docs/getting-started' } }],
        },
        {
          label: 'Core Concepts',
          items: [{ autogenerate: { directory: 'docs/concepts' } }],
        },
        {
          label: 'Adapters',
          items: [
            { label: 'React', items: [{ autogenerate: { directory: 'docs/adapters/react' } }] },
            { label: 'Angular', items: [{ autogenerate: { directory: 'docs/adapters/angular' } }] },
            { label: 'Node / SSR', items: [{ autogenerate: { directory: 'docs/adapters/node' } }] },
            { label: 'DevTools', items: [{ autogenerate: { directory: 'docs/adapters/devtools' } }] },
          ],
        },
        {
          label: 'API Reference',
          items: [{ autogenerate: { directory: 'docs/api' } }],
        },
      ],
    }),
    react(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});