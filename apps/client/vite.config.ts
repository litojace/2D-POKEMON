import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["icons/*.png", "offline.html"],
      injectManifest: {
        globPatterns: [
          "assets/*.{js,css}",
          "assets/fighters/**/*.{svg,png,webp,json}",
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
        orientation: "landscape",
        theme_color: "#101c35",
        background_color: "#101c35",
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
  server: {
    proxy: {
      "/socket.io": { target: "http://localhost:3001", ws: true },
      "/api": "http://localhost:3001",
    },
  },
});
