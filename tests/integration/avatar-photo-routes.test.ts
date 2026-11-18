import { afterEach, beforeEach, expect, it } from "vitest";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";

// The picture routes (migration 20261119110000): an upload is a small WebP
// or JPEG body passed to the database as base64; a picture is served by id
// to anyone, or the default avatar when it is hidden or gone; reports go
// to the database with the reporter's token.
let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string,
  calls: { name: string; args: Record<string, unknown> }[],
  photos: Map<string, { type: string; data: Buffer }>;
const ID = "11111111-2222-4333-8444-555555555555";

beforeEach(async () => {
  accounts = fakeAccounts();
  calls = [];
  photos = new Map();
  accounts.provider.rpc = async (_token, name, args) => {
    calls.push({ name, args });
    if (name === "arena_set_avatar_photo") return `photo:${ID}`;
    if (name === "arena_report_avatar_photo")
      return { reported: true, hidden: false };
    return null;
  };
  accounts.provider.avatarPhoto = async (id) => photos.get(id) ?? null;
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const address = server.http.address();
  if (!address || typeof address === "string") throw Error("No address");
  url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  await server.close();
});

const webp = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4),
  Buffer.from("WEBPVP8 "),
  Buffer.alloc(3000, 1),
]);

it("stores a small WebP for a signed-in player, as base64", async () => {
  const { token } = accounts.add(false);
  const res = await fetch(`${url}/api/account/avatar-photo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/webp" },
    body: webp,
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, avatar: `photo:${ID}` });
  const call = calls.find((c) => c.name === "arena_set_avatar_photo")!;
  expect(call.args.p_type).toBe("image/webp");
  expect(Buffer.from(String(call.args.p_image), "base64").equals(webp)).toBe(
    true,
  );
});

it("refuses no account, other types and big bodies", async () => {
  const { token } = accounts.add(false);
  const send = (body: Buffer, type: string, auth = true) =>
    fetch(`${url}/api/account/avatar-photo`, {
      method: "POST",
      headers: {
        ...(auth ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": type,
      },
      body,
    });
  expect((await send(webp, "image/webp", false)).status).toBe(401);
  expect((await send(webp, "image/png")).status).toBeGreaterThanOrEqual(400);
  expect((await send(Buffer.alloc(70_000, 1), "image/jpeg")).status).toBe(413);
  expect(calls.some((c) => c.name === "arena_set_avatar_photo")).toBe(false);
});

it("serves a picture by id to anyone; a hidden or unknown one is the default", async () => {
  photos.set(ID, { type: "image/webp", data: webp });
  const res = await fetch(`${url}/api/avatar-photo/${ID}`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("image/webp");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(Buffer.from(await res.arrayBuffer()).equals(webp)).toBe(true);
  photos.clear();
  for (const id of [ID, "not-an-id", "zz"]) {
    const gone = await fetch(`${url}/api/avatar-photo/${id}`, {
      redirect: "manual",
    });
    expect([id, gone.status]).toEqual([id, 302]);
    expect(gone.headers.get("location")).toBe(
      "/assets/avatars/ea-avatar-001.webp",
    );
  }
});

it("sends a report with the reporter's own token", async () => {
  const { token } = accounts.add(false);
  const res = await fetch(`${url}/api/avatar-photo/report`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ photo: ID }),
  });
  expect(res.status).toBe(200);
  expect(calls.at(-1)).toEqual({
    name: "arena_report_avatar_photo",
    args: { p_photo: ID, p_message: "" },
  });
});
