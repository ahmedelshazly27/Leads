import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

/** Never ship local test photos (public/__test) in a production build. */
const stripTestAssets = (): Plugin => ({
  name: "strip-test-assets",
  apply: "build",
  closeBundle() {
    rmSync(resolve(__dirname, "dist/__test"), { recursive: true, force: true });
  },
});

export default defineConfig({ plugins: [react(), stripTestAssets()] });
