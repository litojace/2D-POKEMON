// Serves the poster renderer page (scripts/posters/page) with the client's
// own source importable, for build-posters.mjs.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: here("./page"),
  publicDir: false,
  // where the newest bosses' rig painters are read from (build-posters --rigs)
  resolve: {
    alias: {
      "@poster-rigs": process.env.POSTER_RIGS || here("../../apps/client/src"),
    },
  },
  server: { strictPort: false, fs: { allow: [here("../.."), "/tmp"] } },
  logLevel: "warn",
});
