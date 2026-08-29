// ng-packagr publishes from dist/ via plain `npm publish`, not `pnpm publish`
// — so pnpm's automatic workspace:* -> real-semver rewrite never runs.
// Without this, a published tarball ships a literal "workspace:*" dependency
// range, which npm/yarn/anything-but-pnpm can't resolve at all
// (EUNSUPPORTEDPROTOCOL). This script does that rewrite by hand.
//
// Also patches main/types: ng-packagr copies the source package.json's
// "./src/index.ts" values verbatim into dist/, a directory with no src/ —
// harmless for exports-aware resolvers, a broken fallback for anything else.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const angularDir = dirname(dirname(fileURLToPath(import.meta.url)));
const distPkgPath = join(angularDir, "dist", "package.json");
const pkg = JSON.parse(readFileSync(distPkgPath, "utf8"));

pkg.main = pkg.module;
pkg.types = pkg.typings;

for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
  if (!range.startsWith("workspace:")) continue;
  const depVersion = JSON.parse(
    readFileSync(join(angularDir, "..", name.split("/")[1], "package.json"), "utf8"),
  ).version;
  const specifier = range.slice("workspace:".length);
  pkg.dependencies[name] =
    specifier === "*" ? depVersion : specifier === "^" ? `^${depVersion}` : specifier === "~" ? `~${depVersion}` : depVersion;
}

writeFileSync(distPkgPath, JSON.stringify(pkg, null, 2) + "\n");
