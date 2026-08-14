import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage",
      thresholds: {
        statements: 63,
        branches: 58,
        functions: 65,
        lines: 64,
      },
      include: ["src/lib/halo/**/*.ts", "src/app/api/**/route.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "src/lib/halo/**/types.ts",
      ],
    },
  },
});
