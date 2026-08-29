import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      enabled: true, // enforced on plain `vitest run`, no --coverage flag needed
      exclude: [
        ...coverageConfigDefaults.exclude,
        "src/index.ts", // barrel re-export, nothing executable to cover
        "src/types.ts", // type-only
        "src/providers/provider.ts", // type-only re-export
        "src/test-utils/**", // test helpers, not library code
      ],
      // Ratchet floor at/below measured coverage (95.33/90.99/95.12/95.33
      // stmts/branches/funcs/lines as of Phase 7) — fails on regression,
      // not an aspirational number picked before measuring.
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
