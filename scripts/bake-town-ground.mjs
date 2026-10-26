// Rebuild the shipped ground from the real procedural painter. This moves the
// large 3200×2000 painting off phones while preserving a runtime fallback.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../apps/client", import.meta.url));
const out = fileURLToPath(
  new URL("../apps/client/src/art/town-ground.webp", import.meta.url),
);
const server = await createServer({
  root,
  configFile: false,
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
      : {}),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.route("**/paint-ground", (r) =>
    r.fulfill({ contentType: "text/html", body: "<body></body>" }),
  );
  await page.goto(`http://127.0.0.1:${address.port}/paint-ground`);
  const data = await page.evaluate(async () => {
    const { paintGround } = await import("/src/town-art.ts");
    const canvas = document.createElement("canvas");
    canvas.width = 3200;
    canvas.height = 2000;
    paintGround(canvas.getContext("2d", { willReadFrequently: true }));
    return canvas.toDataURL("image/webp", 0.93);
  });
  if (!data.startsWith("data:image/webp;base64,"))
    throw new Error("Browser did not encode WebP");
  await mkdir(new URL("../apps/client/src/art/", import.meta.url), {
    recursive: true,
  });
  const bytes = Buffer.from(data.split(",")[1], "base64");
  await writeFile(out, bytes);
  console.log(
    `Painted town ground: 3200×2000, ${Math.round(bytes.length / 1024)} KiB`,
  );
} finally {
  await browser?.close();
  await server.close();
}
