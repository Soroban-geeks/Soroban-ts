import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/react/**"],
    },
  },
  resolve: {
    // Allow .js extensions in imports to resolve .ts files (ESM interop)
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
});
