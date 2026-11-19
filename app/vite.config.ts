import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

/** Never ship local test photos (public/__test) in a production build. */
const stripTestAssets = (): Plugin => {
  let outDir = resolve(__dirname, "dist");
  return {
    name: "strip-test-assets",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      rmSync(resolve(outDir, "__test"), { recursive: true, force: true });
    },
  };
};

/**
 * Long-lived vendor chunks. Both are needed by the entry on every page, so Vite
 * preloads them in parallel from the HTML (no waterfall); keeping them apart from
 * app code means a deploy does not invalidate them in the browser cache.
 * Everything else (MediaPipe, Supabase, the marker catalog, pages) is left to
 * Rollup, which places it in the lazy page chunks that use it.
 */
const VENDOR: [RegExp, string][] = [
  [/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, "react"],
  [/[\\/]node_modules[\\/](react-router|react-router-dom|@remix-run[\\/]router)[\\/]/, "router"],
];

/**
 * The installed MediaPipe version. scripts/setup-vision.mjs copies the WASM runtime
 * to public/wasm/<this version>/, and lib/vision.ts loads it (or the CDN copy) at the
 * same version, so the runtime always matches the JS API that was bundled.
 */
const MEDIAPIPE_VERSION: string = JSON.parse(
  readFileSync(resolve(__dirname, "node_modules/@mediapipe/tasks-vision/package.json"), "utf8"),
).version;

export default defineConfig({
  plugins: [react(), stripTestAssets()],
  define: {
    __MEDIAPIPE_VERSION__: JSON.stringify(MEDIAPIPE_VERSION),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          return VENDOR.find(([re]) => re.test(id))?.[1];
        },
      },
    },
  },
});
