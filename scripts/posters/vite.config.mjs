// Serves the poster renderer page (scripts/posters/page) with the client's
// own source importable, for build-posters.mjs.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: here("./page"),
  publicDir: false,
  server: { strictPort: false, fs: { allow: [here("../.."), "/tmp"] } },
  logLevel: "warn",
});
