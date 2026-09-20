import { defineConfig } from "vite";

import { BROWSER_TARGET } from "../../packages/reflected-ffi/browser-target.ts";

const COOP_COEP_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  server: { headers: COOP_COEP_HEADERS },
  preview: { headers: COOP_COEP_HEADERS },
  build: {
    target: BROWSER_TARGET,
  },
});
