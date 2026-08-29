const path = require("node:path");

/**
 * Angular's stock webpack-based karma builder doesn't transform .ts source
 * reached through node_modules (even a symlinked pnpm workspace package),
 * so @useoptimus/core/@useoptimus/node — consumed elsewhere in this
 * repo via "main": "./src/index.ts" — resolve to broken modules under
 * Karma specifically. Alias them to their built dist/ output instead
 * (run `pnpm --filter @useoptimus/core build` / `...node build` first).
 */
module.exports = {
  resolve: {
    alias: {
      "@useoptimus/core": path.resolve(__dirname, "../core/dist/index.js"),
      "@useoptimus/node": path.resolve(__dirname, "../node/dist/index.js"),
    },
  },
};
