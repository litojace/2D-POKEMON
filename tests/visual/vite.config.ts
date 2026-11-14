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
  server: { port: 4179, strictPort: true, fs: { allow: [here("../..")] } },
  logLevel: "warn",
});
