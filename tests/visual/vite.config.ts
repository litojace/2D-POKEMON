// The real client with its network packages swapped for in-page stand-ins
// (see harness/). Used only by the visual checks.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: here("./harness"),
  publicDir: here("../../apps/client/public"),
  resolve: {
    alias: [
      { find: "socket.io-client", replacement: here("./harness/stubs.ts") },
      {
        find: "@supabase/supabase-js",
        replacement: here("./harness/stubs.ts"),
      },
      { find: "virtual:pwa-register", replacement: here("./harness/stubs.ts") },
      // The client's GPU probe (see the fake for why).
      {
        find: /^\.\.?\/gpu-check$/,
        replacement: here("./harness/gpu-check-fake.ts"),
      },
    ],
  },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("http://offline"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("offline"),
    "import.meta.env.VITE_SERVER_URL": JSON.stringify(""),
    "import.meta.env.VITE_SITE_URL": JSON.stringify(""),
  },
  server: {
    port: Number(process.env.VISUAL_PORT) || 4179,
    strictPort: true,
    fs: { allow: [here("../..")] },
  },
  logLevel: "warn",
  plugins: [
    {
      // Pictures the game server serves by id (docs/hidden-picks.md,
      // "Avatars"): any player's avatar is the default one here, and a
      // player's own picture is a plain pink disc. Tests that care route
      // these themselves (page.route wins over this).
      name: "fake-avatar-pictures",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url ?? "";
          if (url.startsWith("/api/avatar/of/")) {
            res.statusCode = 302;
            res.setHeader("Location", "/assets/avatars/ea-avatar-001.webp");
            return res.end();
          }
          if (url.startsWith("/api/avatar-photo/")) {
            res.statusCode = 302;
            res.setHeader("Location", "/assets/avatars/ea-avatar-014.webp");
            return res.end();
          }
          next();
        });
      },
    },
  ],
});
