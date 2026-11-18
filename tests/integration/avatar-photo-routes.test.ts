import { afterEach, beforeEach, expect, it } from "vitest";
import { createArenaServer } from "../../apps/server/src/server";
import { createAvatarPhotoStore } from "../../apps/server/src/avatar-photos";
import { fakeAccounts } from "../helpers/accounts";
import { fakePhotoClient, webpBytes } from "../helpers/photo-client";

// The picture routes (migrations 20261119110000 and 20261119120000): an
// upload is a small WebP or JPEG body that the server puts in the private
// Storage bucket and the database then keeps; a picture is served by id to
// anyone, or the default avatar when it is hidden or gone; reports go to
// the database with the reporter's token; an admin's removal deletes the
// file. Storage is a fake (tests/helpers/photo-client.ts).
let server: ReturnType<typeof createArenaServer>,
  accounts: ReturnType<typeof fakeAccounts>,
  url: string,
  calls: { name: string; args: Record<string, unknown> }[],
  storage: ReturnType<typeof fakePhotoClient>;
const ID = "11111111-2222-4333-8444-555555555555";

beforeEach(async () => {
  accounts = fakeAccounts();
  calls = [];
  storage = fakePhotoClient();
  accounts.provider.rpc = async (_token, name, args) => {
    calls.push({ name, args });
    if (name === "arena_report_avatar_photo")
      return { reported: true, hidden: false };
    if (name === "arena_admin_avatar_photo_image") {
      const row = storage.rows.get(String(args.p_photo));
      return row
        ? { type: row.type, path: row.path, hidden: row.hidden }
        : null;
    }
    if (name === "arena_admin_avatar_photo") {
      const row = storage.rows.get(String(args.p_photo));
      if (!row) return null;
      if (args.p_keep) return { owner: row.user, path: null };
      storage.rows.delete(String(args.p_photo));
      return { owner: row.user, path: row.path };
    }
    return null;
  };
  accounts.provider.photos = createAvatarPhotoStore(() => storage.client);
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

const webp = webpBytes();
const upload = (token: string, body: Buffer = webp, type = "image/webp") =>
  fetch(`${url}/api/account/avatar-photo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": type },
    body,
  });

it("puts a small WebP in the bucket for a signed-in player, and the database keeps it", async () => {
  const { token, account } = accounts.add(false);
  const res = await upload(token);
  expect(res.status).toBe(200);
  const body = (await res.json()) as { ok: boolean; avatar: string };
  expect(body.ok).toBe(true);
  expect(body.avatar).toMatch(/^photo:[0-9a-f-]{36}$/);
  const id = body.avatar.slice(6);
  expect(storage.files.get(`photos/${id}.webp`)?.data.equals(webp)).toBe(true);
  // Saved for the player the server signed in, with the service role.
  expect(storage.rows.get(id)?.user).toBe(account.id);
  // Served back, the same bytes.
  const got = await fetch(`${url}/api/avatar-photo/${id}`);
  expect(got.status).toBe(200);
  expect(Buffer.from(await got.arrayBuffer()).equals(webp)).toBe(true);
});

it("a refused picture (a guest) is a 403 and leaves no file", async () => {
  const { token, account } = accounts.add(false);
  storage.refused.set(account.id, "Make an account to use your own picture.");
  const res = await upload(token);
  expect(res.status).toBe(403);
  expect((await res.json()).error).toMatch(/Make an account/);
  expect(storage.files.size).toBe(0);
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
  // A body that isn't what its type says never reaches Storage.
  expect((await send(webp, "image/jpeg")).status).toBe(400);
  expect(storage.log).toEqual([]);
});

it("serves a picture by id to anyone; a hidden or unknown one is the default", async () => {
  const { token } = accounts.add(false);
  const id = (
    (await (await upload(token)).json()) as { avatar: string }
  ).avatar.slice(6);
  const res = await fetch(`${url}/api/avatar-photo/${id}`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("image/webp");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("cache-control")).toBe("public, max-age=600");
  expect(Buffer.from(await res.arrayBuffer()).equals(webp)).toBe(true);
  // Hidden by reports: the file is still in the bucket, but not served.
  storage.rows.get(id)!.hidden = true;
  for (const gone of [id, ID, "not-an-id", "zz"]) {
    const res = await fetch(`${url}/api/avatar-photo/${gone}`, {
      redirect: "manual",
    });
    expect([gone, res.status]).toEqual([gone, 302]);
    expect(res.headers.get("location")).toBe(
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

it("points any player's id at their avatar's picture", async () => {
  const avatars = new Map<string, string | null>([
    ["aaaaaaaa-0000-4000-8000-000000000001", "ea-avatar-033"],
    ["aaaaaaaa-0000-4000-8000-000000000002", `photo:${ID}`],
    ["aaaaaaaa-0000-4000-8000-000000000003", null],
  ]);
  accounts.provider.avatarOf = async (id) => avatars.get(id) ?? null;
  const where = async (id: string) =>
    (
      await fetch(`${url}/api/avatar/of/${id}`, { redirect: "manual" })
    ).headers.get("location");
  // A retired avatar (the first library's Anime 2D Terradon): the same
  // character's avatar now.
  expect(await where("aaaaaaaa-0000-4000-8000-000000000001")).toBe(
    "/assets/avatars/ea-avatar-007.webp",
  );
  expect(await where("aaaaaaaa-0000-4000-8000-000000000002")).toBe(
    `/api/avatar-photo/${ID}`,
  );
  for (const id of ["aaaaaaaa-0000-4000-8000-000000000003", "nope"])
    expect(await where(id)).toBe("/assets/avatars/ea-avatar-001.webp");
});

it("an admin sees a reported picture from the bucket, and removing it deletes the file", async () => {
  const { token: player } = accounts.add(false);
  const id = (
    (await (await upload(player)).json()) as { avatar: string }
  ).avatar.slice(6);
  storage.rows.get(id)!.hidden = true;
  const { token: admin } = accounts.add(true);
  const seen = await fetch(`${url}/api/admin/avatar-photo/${id}`, {
    headers: { Authorization: `Bearer ${admin}` },
  });
  expect(await seen.json()).toEqual({
    src: `data:image/webp;base64,${webp.toString("base64")}`,
    hidden: true,
  });
  const removed = await fetch(`${url}/api/admin/avatar-photo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${admin}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ photo: id, keep: false }),
  });
  expect(removed.status).toBe(200);
  expect(storage.files.size).toBe(0);
  expect(calls.at(-1)?.name).toBe("arena_admin_avatar_photo");
});

it("deleting your account deletes your picture's file", async () => {
  const { token } = accounts.add(false);
  await upload(token);
  expect(storage.files.size).toBe(1);
  const res = await fetch(`${url}/api/account/delete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ confirm: true }),
  });
  expect(res.status).toBe(200);
  expect(calls.some((c) => c.name === "arena_delete_my_account")).toBe(true);
  expect(storage.files.size).toBe(0);
});
