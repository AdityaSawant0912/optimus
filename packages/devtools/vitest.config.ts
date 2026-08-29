import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "jsdom",
    coverage: {
      provider: "v8",
      enabled: true,
      exclude: [...coverageConfigDefaults.exclude, "src/index.ts"],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
