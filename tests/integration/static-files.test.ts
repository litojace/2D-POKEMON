import { afterEach, beforeEach, expect, it } from "vitest";
import { createArenaServer } from "../../apps/server/src/server.js";
import { fakeAccounts } from "../helpers/accounts";

// A missing script or stylesheet must be a 404. Answering it with the app page
// (200, text/html) let the installed app's offline cache store that page as
// the game's code and stylesheet, so the app opened unstyled on the rotate
// notice until its cache was cleared.
let server: ReturnType<typeof createArenaServer>;
let url = "";
beforeEach(async () => {
  server = createArenaServer({ autoTick: false, accounts: fakeAccounts().provider });
  await new Promise<void>((resolve) => server.http.listen(0, "127.0.0.1", resolve));
  const address = server.http.address();
  if (!address || typeof address === "string") throw Error("No port");
  url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  server.io.close();
  await new Promise<void>((resolve) => server.http.close(() => resolve()));
});

it("answers a missing build file with 404, never the app page", async () => {
  for (const file of ["/assets/index-OLDHASH1.css", "/assets/index-OLDHASH2.js", "/assets/fighters/x.webp", "/icons/missing.png"]) {
    const res = await fetch(url + file);
    expect(res.status, file).toBe(404);
    expect(res.headers.get("content-type"), file).not.toContain("text/html");
    expect(res.headers.get("cache-control"), file).toBe("no-store");
  }
});
