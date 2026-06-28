import { defineConfig, type Plugin } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// In the Cloudflare Workers build, @cloudflare/vite-plugin handles *.bin →
// ArrayBuffer automatically. Vitest runs in Node.js where that plugin is
// absent, so this lightweight shim replicates the same contract.
const binLoader: Plugin = {
  name: "bin-loader",
  load(id) {
    if (!id.endsWith(".bin")) return;
    const escaped = JSON.stringify(id);
    return `import{readFileSync}from"node:fs";const b=readFileSync(${escaped});export default b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);`;
  },
};

export default defineConfig({
  plugins: [tsconfigPaths(), binLoader],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
