import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { LEGACY_AUTH_PATHS } from "./src/auth-redirect";

/**
 * Emails sent before auth links moved to `/?auth=…` still point at
 * `/email-confirmed`, `/reset-password` and `/auth/callback`. The Static Site
 * has no rewrite rule for them (and a blanket `/*` rewrite would answer
 * missing scripts with HTML), so put the game page at those paths instead:
 * `<path>/index.html` and `<path>.html`, whichever form the host resolves.
 * The app reads the path itself (`readAuthReturn`), and every asset URL is
 * absolute, so the copy works at any depth.
 */
function legacyAuthPages(): Plugin {
  let outDir = "dist";
  return {
    name: "legacy-auth-pages",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const page = join(outDir, "index.html");
      for (const path of LEGACY_AUTH_PATHS) {
        for (const file of [
          join(outDir, path, "index.html"),
          join(outDir, `${path}.html`),
        ]) {
          mkdirSync(dirname(file), { recursive: true });
          copyFileSync(page, file);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    legacyAuthPages(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["icons/*.png", "offline.html"],
      injectManifest: {
        globPatterns: [
          "assets/*.{js,css,webp}",
          "assets/fonts/*.woff2",
          "assets/backgrounds/*.webp",
          "assets/music/*.mp3",
          "assets/fighters/**/*.{svg,png,webp,json}",
        ],
        globIgnores: [
          "assets/fighters/**/portrait-showcase-v1.webp",
          "assets/town/fountain.webp",
          "assets/town/ground.webp",
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        id: "/",
        name: "Element Arena",
        short_name: "Element Arena",
        description: "Real-time arena duels with your friends.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        // Chrome/Edge open the installed app with no status bar; others fall back.
        display_override: ["fullscreen", "standalone"],
        orientation: "landscape",
        theme_color: "#0b1020",
        background_color: "#0b1020",
        icons: [
          {
            src: "/icons/arena-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/arena-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/arena-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Libraries change far less often than the game. As their own files
        // they stay cached across deploys, so an update downloads only the
        // game code (Phaser alone is about half the total).
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/phaser/")) return "phaser";
          return "vendor";
        },
      },
    },
    // Phaser is one ~1.5 MB library and can't be split further.
    chunkSizeWarningLimit: 1600,
  },
  server: {
    proxy: {
      "/socket.io": { target: "http://localhost:3001", ws: true },
      "/api": "http://localhost:3001",
    },
  },
});
