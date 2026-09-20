import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

import { BROWSER_TARGET } from "./browser-target.ts";

export default defineConfig({
  plugins: [
    dts({
      bundleTypes: false,
      entryRoot: "src",
      include: ["src/**/*.ts"],
    }),
  ],
  build: {
    target: BROWSER_TARGET,
    lib: {
      entry: {
        types: "src/types.ts",
        traps: "src/utils/traps.ts",
        "utils/index": "src/utils/index.ts",
        "utils/symbol": "src/utils/symbol.ts",
        "utils/global": "src/utils/global.ts",
        query: "src/utils/query.ts",
        gather: "src/utils/gather.ts",
        "to-json-callback": "src/utils/to-json-callback.ts",
        "utils/heap": "src/utils/heap.ts",
        "utils/events": "src/utils/events.ts",
        array: "src/direct/array.ts",
        buffer: "src/direct/buffer.ts",
        decoder: "src/direct/decoder.ts",
        encoder: "src/direct/encoder.ts",
        "direct/index": "src/direct/index.ts",
        local: "src/local.ts",
        remote: "src/remote.ts",
      },
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        preserveModules: false,
      },
    },
  },
});
