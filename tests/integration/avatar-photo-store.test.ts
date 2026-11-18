import { beforeEach, expect, it, vi } from "vitest";
import { createAvatarPhotoStore } from "../../apps/server/src/avatar-photos";
import { AccountError } from "../../apps/server/src/accounts";
import { fakePhotoClient, jpegBytes, webpBytes } from "../helpers/photo-client";

// Players' pictures in Supabase Storage (apps/server/src/avatar-photos.ts):
// the file goes to the private bucket before the database takes it, a
// refused or failed save leaves no file behind, the old picture's file is
// deleted, and a picture is read only when its row says it may be seen.
const ANA = "00000000-0000-4000-8000-0000000033a1";
let fake: ReturnType<typeof fakePhotoClient>,
  store: ReturnType<typeof createAvatarPhotoStore>;
beforeEach(() => {
  fake = fakePhotoClient();
  store = createAvatarPhotoStore(() => fake.client);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
const idOf = (avatar: string) => avatar.slice("photo:".length);

it("uploads the file first, then the database keeps it; the file is served by id", async () => {
  const avatar = await store.save(ANA, "image/webp", webpBytes());
  const id = idOf(avatar);
  expect(fake.log).toEqual([
    `upload photos/${id}.webp`,
    "arena_save_avatar_photo",
  ]);
  expect(fake.files.get(`photos/${id}.webp`)?.type).toBe("image/webp");
  const read = await store.read(id);
  expect(read?.type).toBe("image/webp");
  expect(read?.data.equals(webpBytes())).toBe(true);
});

it("a new picture deletes the old one's file", async () => {
  const first = idOf(await store.save(ANA, "image/webp", webpBytes()));
  const next = idOf(await store.save(ANA, "image/jpeg", jpegBytes()));
  expect([...fake.files.keys()]).toEqual([`photos/${next}.jpg`]);
  expect(await store.read(first)).toBeNull();
  expect(fake.log).toContain(`remove photos/${first}.webp`);
});

it("refused (a guest, a removed picture's 7 days): the uploaded file goes again", async () => {
  fake.refused.set(ANA, "Make an account to use your own picture.");
  const e = await store
    .save(ANA, "image/webp", webpBytes())
    .catch((e: unknown) => e);
  expect(e).toBeInstanceOf(AccountError);
  expect((e as AccountError).status).toBe(403);
  expect((e as AccountError).message).toMatch(/Make an account/);
  expect(fake.files.size).toBe(0);
});

it("the database failing: a retryable error and no file left", async () => {
  fake.fail.add("save");
  const e = (await store
    .save(ANA, "image/webp", webpBytes())
    .catch((e: unknown) => e)) as AccountError;
  expect(e.status).toBe(503);
  expect(fake.files.size).toBe(0);
});

it("Storage failing: a retryable error and nothing recorded", async () => {
  fake.fail.add("upload");
  const e = (await store
    .save(ANA, "image/webp", webpBytes())
    .catch((e: unknown) => e)) as AccountError;
  expect(e.status).toBe(503);
  expect(e.message).toMatch(/try again/);
  expect(fake.log).not.toContain("arena_save_avatar_photo");
  expect(fake.rows.size).toBe(0);
});

it("checks the file is what it says before uploading", async () => {
  for (const [type, data] of [
    ["image/webp", jpegBytes()],
    ["image/jpeg", webpBytes()],
    ["image/webp", Buffer.from("RIFF")],
  ] as const) {
    await expect(store.save(ANA, type, data)).rejects.toThrow(
      /could not be read/,
    );
  }
  expect(fake.log).toEqual([]);
});

it("a hidden picture isn't read, even though its file is still there", async () => {
  const id = idOf(await store.save(ANA, "image/webp", webpBytes()));
  fake.rows.get(id)!.hidden = true;
  expect(await store.read(id)).toBeNull();
  expect(fake.files.size).toBe(1);
});

it("a missing file or Storage failing reads as no picture (the default avatar)", async () => {
  const id = idOf(await store.save(ANA, "image/webp", webpBytes()));
  fake.fail.add("download");
  expect(await store.read(id)).toBeNull();
  fake.files.clear();
  expect(await store.read(id)).toBeNull();
});

it("only touches files at photos/<id>.webp|jpg; a failed delete is logged, not thrown", async () => {
  expect(await store.file("../secret.webp", "image/webp")).toBeNull();
  await store.remove(["../secret", null, undefined]);
  expect(fake.log).toEqual([]);
  const id = idOf(await store.save(ANA, "image/webp", webpBytes()));
  expect(await store.pathOf(ANA)).toBe(`photos/${id}.webp`);
  fake.fail.add("remove");
  await expect(store.remove([`photos/${id}.webp`])).resolves.toBeUndefined();
  expect(console.warn).toHaveBeenCalled();
});
