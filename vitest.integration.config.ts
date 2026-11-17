import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Both report suites exercise the same persistent worker queue.
  test: { fileParallelism: false, include: ["tests/integration/**/*.test.ts"], setupFiles: ["tests/support/load-env.ts"] },
});
