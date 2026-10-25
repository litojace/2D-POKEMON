// The real client with its network packages swapped for in-page stand-ins
// (see harness/). Used only by the visual checks.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: here("./harness"),
  publicDir: here("../../apps/client/public"),
  resolve: {
    alias: {
      "socket.io-client": here("./harness/stubs.ts"),
      "@supabase/supabase-js": here("./harness/stubs.ts"),
      "virtual:pwa-register": here("./harness/stubs.ts"),
    },
  },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("http://offline"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("offline"),
    "import.meta.env.VITE_SERVER_URL": JSON.stringify(""),
    "import.meta.env.VITE_SITE_URL": JSON.stringify(""),
    "import.meta.env.VITE_GOOGLE_SIGN_IN": JSON.stringify(""),
  },
  server: { port: 4179, strictPort: true, fs: { allow: [here("../..")] } },
  logLevel: "warn",
});
