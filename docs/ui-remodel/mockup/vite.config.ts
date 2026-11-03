// The UI remodel mockups: a page that imports the real client modules
// (fighter art, the Shop catalogue, raid data) so every picture and number is
// the game's own. Run from the repo root:
//   npx vite --config docs/ui-remodel/mockup/vite.config.ts
// then open http://localhost:4180/?s=shop&d=desktop
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: here("."),
  // Fonts and the backdrop are imported by the CSS, so the demo build is
  // self-contained (npx vite build --config docs/ui-remodel/mockup/vite.config.ts).
  publicDir: false,
  base: "./",
  build: {
    outDir: process.env.MOCKUP_OUT ?? here("dist"),
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
  server: { port: 4180, strictPort: true, fs: { allow: [here("../../..")] } },
  logLevel: "warn",
});
