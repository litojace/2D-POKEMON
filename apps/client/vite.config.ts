import { defineConfig, type Plugin, type Rollup } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { LEGACY_AUTH_PATHS } from "./src/auth-redirect";

/**
 * Emails sent before auth links moved to `/?auth=…` still point at
 * `/email-confirmed`, `/reset-password` and `/auth/callback`. The Static Site
 * has no rewrite rule for them (and a blanket `/*` rewrite would answer
 * missing scripts with HTML), so put the game page at `<path>.html`. Render
 * serves `<path>.html` for both `/<path>` and `/<path>/` (checked on the live
 * site with `/index` and `/index/`), so no `<path>/index.html` copy is needed.
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
        const file = join(outDir, `${path}.html`);
        mkdirSync(dirname(file), { recursive: true });
        copyFileSync(page, file);
      }
    },
  };
}

/**
 * The scripts the game page loads to start: its entry and everything that
 * entry imports statically (Phaser, the libraries). Recorded while bundling
 * so the service worker precaches exactly these, and the Lobby panels that
 * load on first use (PRECACHED_PANELS); scripts loaded later (the Plaza,
 * the shop preview) are cached when first used.
 */
const startupScripts = new Set<string>();
/** Panels split out of the startup bundle, precached all the same. */
const PRECACHED_PANELS =
  /\/src\/screens\/(raid-hall|fitting-room|journey)\.ts$/;
function startupScriptList(): Plugin {
  return {
    name: "startup-script-list",
    apply: "build",
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(
        (file): file is Rollup.OutputChunk => file.type === "chunk",
      );
      // Only the page's own build (not the service worker's).
      const entries = chunks.filter(
        (chunk) =>
          chunk.isEntry && chunk.facadeModuleId?.endsWith("index.html"),
      );
      if (!entries.length) return;
      startupScripts.clear();
      const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
      // The Lobby's panels that load on first use (accounts.ts) and Phaser
      // are installed ahead of time too: they open at once, offline as
      // well, without the game parsing them at startup.
      const lazyPanels = chunks.filter(
        (chunk) =>
          PRECACHED_PANELS.test(chunk.facadeModuleId ?? "") ||
          // Phaser and the battle kit load after the first screen
          // (phaser-runtime.ts), but every battle needs them, offline too.
          chunk.name === "phaser" ||
          chunk.name === "battle-kit",
      );
      const queue = [...entries, ...lazyPanels].map((chunk) => chunk.fileName);
      while (queue.length) {
        const file = queue.pop()!;
        if (startupScripts.has(file)) continue;
        startupScripts.add(file);
        queue.push(...(byFile.get(file)?.imports ?? []));
      }
    },
  };
}
/**
 * Hashed artwork installed ahead of time (scripts/verify-pwa.mjs checks it):
 * the startup screen's starfield and sigil, and the bosses' spell flipbook,
 * so a raid starts without downloading it.
 *
 * Not the paintings behind the startup curtain (startup-art-*, 3 MB for
 * thirteen): a start shows one, which the start before chose and downloaded
 * (loading-art.ts prepareNextArt), and the service worker keeps it (sw.ts).
 * Installing all of them competed with the first Lobby for the connection.
 */
const PRECACHED_ART =
  /^assets\/(startup-starfield-|startup-sigil-|raid-whole-|raid-directions-|raid-spell-flipbook-)/;
/**
 * A fighter's files in public/assets/fighters/<id>/ are downloaded only for
 * a pack of frames, a sheet or an atlas (animation/pipeline.ts
 * queueFighterAssets, fighter-selection.ts). A layered fighter, which all
 * are today, is drawn by the client: its animations.json is compiled into
 * the script (animation/pack-config.ts) and its two pictures are never
 * requested, so none of its files is installed.
 */
const fighterPackKind = new Map<string, string>();
function fighterFileNeeded(url: string) {
  const id = url.match(/^assets\/fighters\/([^/]+)\//)?.[1];
  if (!id) return true;
  if (!fighterPackKind.has(id)) {
    let kind = "unknown";
    try {
      kind = JSON.parse(
        readFileSync(
          resolve(__dirname, `public/assets/fighters/${id}/animations.json`),
          "utf8",
        ),
      ).kind;
    } catch {
      // No pack file: keep what is there.
    }
    fighterPackKind.set(id, kind);
  }
  return fighterPackKind.get(id) !== "layered";
}
/**
 * What the service worker installs ahead of time: the shell the game needs
 * to start (startup scripts, styles, fonts, icons, the offline page), the
 * artwork above, and the public files that keep their names (music,
 * backgrounds, fonts), which need its revision checks to stay current.
 * Hashed scripts loaded later (the Plaza, the shop preview), the startup
 * paintings and the other raid art (splash pictures, thumbnails, portraits,
 * illustrated arenas) are cached by the service worker when first used
 * instead (sw.ts).
 */
function precached(url: string) {
  if (/^assets\/[^/]+\.js$/.test(url))
    // Unknown (a build without the list): keep every script, as before.
    return !startupScripts.size || startupScripts.has(url);
  if (/^assets\/[^/]+\.webp$/.test(url)) return PRECACHED_ART.test(url);
  return fighterFileNeeded(url);
}

/**
 * The commit this build is made from, for battle-perf's `build` and the
 * title screen's version: Render sets RENDER_GIT_COMMIT while it builds;
 * otherwise ask git, else "dev".
 */
function buildId() {
  const fromRender = process.env.RENDER_GIT_COMMIT?.slice(0, 7);
  if (fromRender) return fromRender;
  try {
    return execSync("git rev-parse --short=7 HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}
/**
 * The build id goes on the page (a <meta>, read by src/build-id.ts), not
 * into the scripts. As a constant in the script it changed the startup
 * script's contents, so its hashed name, so the name of every script that
 * imports it, on every deploy: phones downloaded the whole game again
 * (about 1 MB compressed) after deploys that changed nothing they run, and
 * were asked to update for them. The page is never cached (sw.ts).
 */
function buildIdMeta(): Plugin {
  return {
    name: "build-id-meta",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { name: "arena-build", content: buildId() },
        injectTo: "head",
      },
    ],
  };
}

export default defineConfig({
  plugins: [
    buildIdMeta(),
    legacyAuthPages(),
    startupScriptList(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: false,
      // The icons a page or a notification shows. The two 512 px ones are
      // the install manifest's: the browser fetches those itself, once.
      includeManifestIcons: false,
      includeAssets: [
        "icons/arena-192.png",
        "icons/apple-touch-icon.png",
        "offline.html",
      ],
      injectManifest: {
        globPatterns: [
          "assets/*.{js,css,webp}",
          "assets/fonts/*.woff2",
          "assets/backgrounds/*.webp",
          "assets/music/*.mp3",
          "assets/fighters/**/*.{svg,png,webp,json}",
        ],
        globIgnores: ["assets/fighters/**/portrait-showcase-v1.webp"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Only a name with Vite's content hash needs no revision. The
        // plugin's default is everything under assets/, which also holds
        // the public files that keep their names (music, backgrounds,
        // fonts): with no revision, a phone that had one never fetched it
        // again after it changed.
        dontCacheBustURLsMatching: /^assets\/[^/]+-[\w-]{8}\.\w+$/,
        manifestTransforms: [
          (entries) => ({
            manifest: entries.filter((entry) => precached(entry.url)),
            warnings: startupScripts.size
              ? []
              : ["Startup scripts unknown: every script is precached."],
          }),
        ],
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
          // Only shared pictures draw a QR code: the encoder loads with
          // them (share-qr.ts), not with the game's first scripts.
          if (id.includes("/qrcode-generator/")) return;
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
