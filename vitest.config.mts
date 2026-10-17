import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage",
      thresholds: {
        statements: 76,
        branches: 72,
        functions: 75,
        lines: 76,
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
