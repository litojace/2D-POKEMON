import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import {
  ALBUM_LIMIT,
  openAlbum,
  photoDay,
  pictureName,
  type NewAlbumPhoto,
} from "../../apps/client/src/plaza/plaza-album";

// The album lives in the browser's IndexedDB. fake-indexeddb is an in-memory
// IndexedDB that follows the spec, so these run the store's real code; each
// test gets a fresh one.
const photo = (n: number): NewAlbumPhoto => ({
  at: Date.UTC(2026, 10, 3, 10, n),
  caption: `tester with Rin #${n}`,
  place: `Elemental Plaza · 10:${String(n).padStart(2, "0")}`,
  image: new Blob([`image ${n}`], { type: "image/jpeg" }),
  thumb: new Blob([`thumb ${n}`], { type: "image/jpeg" }),
});
const captions = async (album: ReturnType<typeof openAlbum>) =>
  (await album.list()).map((p) => p.caption);

describe("the Plaza photo album", () => {
  it("keeps 30 photos", () => {
    expect(ALBUM_LIMIT).toBe(30);
  });

  it("adds a photo with its picture, thumbnail and caption", async () => {
    const album = openAlbum({ factory: new IDBFactory() });
    expect(await album.list()).toEqual([]);
    const added = await album.add(photo(1));
    expect(added).toEqual({ id: expect.any(Number), count: 1, dropped: 0 });
    const [saved] = await album.list();
    expect(saved.id).toBe(added.id);
    expect(saved.caption).toBe("tester with Rin #1");
    expect(saved.place).toBe("Elemental Plaza · 10:01");
    expect(saved.at).toBe(Date.UTC(2026, 10, 3, 10, 1));
    expect(saved.image.type).toBe("image/jpeg");
    expect(await saved.image.text()).toBe("image 1");
    expect(await saved.thumb.text()).toBe("thumb 1");
    expect((await album.get(added.id))?.caption).toBe("tester with Rin #1");
    expect(await album.count()).toBe(1);
  });

  it("lists the newest first, and ids only grow", async () => {
    const album = openAlbum({ factory: new IDBFactory() });
    const ids = [];
    for (const n of [1, 2, 3]) ids.push((await album.add(photo(n))).id);
    expect(ids[1]).toBeGreaterThan(ids[0]);
    expect(ids[2]).toBeGreaterThan(ids[1]);
    expect(await captions(album)).toEqual([
      "tester with Rin #3",
      "tester with Rin #2",
      "tester with Rin #1",
    ]);
  });

  it("keeps the newest 30: the 31st photo pushes out the oldest", async () => {
    const album = openAlbum({ factory: new IDBFactory() });
    for (let n = 1; n <= 30; n++) {
      const added = await album.add(photo(n));
      expect(added).toMatchObject({ count: n, dropped: 0 });
    }
    const added = await album.add(photo(31));
    expect(added).toMatchObject({ count: 30, dropped: 1 });
    expect(await album.count()).toBe(30);
    const list = await captions(album);
    expect(list).toHaveLength(30);
    expect(list[0]).toBe("tester with Rin #31");
    expect(list.at(-1)).toBe("tester with Rin #2");
    expect(list).not.toContain("tester with Rin #1");
    // And again: always one in, one out.
    expect(await album.add(photo(32))).toMatchObject({
      count: 30,
      dropped: 1,
    });
    expect((await captions(album)).at(-1)).toBe("tester with Rin #3");
  });

  it("keeps the limit when two saves land at once", async () => {
    const album = openAlbum({ factory: new IDBFactory(), limit: 3 });
    for (const n of [1, 2, 3]) await album.add(photo(n));
    const both = await Promise.all([album.add(photo(4)), album.add(photo(5))]);
    expect(both.map((a) => a.dropped)).toEqual([1, 1]);
    expect(await captions(album)).toEqual([
      "tester with Rin #5",
      "tester with Rin #4",
      "tester with Rin #3",
    ]);
  });

  it("deletes one photo and leaves the rest", async () => {
    const album = openAlbum({ factory: new IDBFactory() });
    const ids = [];
    for (const n of [1, 2, 3]) ids.push((await album.add(photo(n))).id);
    await album.remove(ids[1]);
    expect(await captions(album)).toEqual([
      "tester with Rin #3",
      "tester with Rin #1",
    ]);
    expect(await album.get(ids[1])).toBeUndefined();
    expect(await album.count()).toBe(2);
    // Deleting it again, or an id that never was, changes nothing.
    await album.remove(ids[1]);
    await album.remove(9999);
    expect(await album.count()).toBe(2);
    // A deleted photo's id is never reused, so "newest first" stays true.
    const next = await album.add(photo(4));
    expect(next.id).toBeGreaterThan(ids[2]);
    expect((await captions(album))[0]).toBe("tester with Rin #4");
  });

  it("a deleted photo frees a slot: no photo is pushed out", async () => {
    const album = openAlbum({ factory: new IDBFactory(), limit: 3 });
    const ids = [];
    for (const n of [1, 2, 3]) ids.push((await album.add(photo(n))).id);
    await album.remove(ids[2]);
    expect(await album.add(photo(4))).toMatchObject({
      count: 3,
      dropped: 0,
    });
    expect(await captions(album)).toEqual([
      "tester with Rin #4",
      "tester with Rin #2",
      "tester with Rin #1",
    ]);
  });

  it("is still there after the Plaza closes and opens again", async () => {
    const factory = new IDBFactory();
    const first = openAlbum({ factory });
    await first.add(photo(1));
    first.close();
    const again = openAlbum({ factory });
    expect(await captions(again)).toEqual(["tester with Rin #1"]);
    again.close();
  });

  it("fails plainly without IndexedDB, and tries again next time", async () => {
    let calls = 0;
    const real = new IDBFactory();
    const flaky = {
      open(name: string, version?: number) {
        if (++calls === 1)
          throw new DOMException("No storage here", "SecurityError");
        return real.open(name, version);
      },
    } as unknown as IDBFactory;
    const album = openAlbum({ factory: flaky });
    await expect(album.add(photo(1))).rejects.toThrow("No storage here");
    expect((await album.add(photo(2))).count).toBe(1);
    const none = openAlbum({ factory: undefined, name: "nowhere" });
    if (!(globalThis as { indexedDB?: unknown }).indexedDB)
      await expect(none.list()).rejects.toThrow("IndexedDB is not available");
  });
});

describe("album labels", () => {
  it("names a saved picture by its local date and time", () => {
    expect(pictureName(new Date(2026, 10, 3, 9, 4).getTime())).toBe(
      "elemental-plaza-2026-11-03-0904.jpg",
    );
  });
  it("writes the day in English", () => {
    expect(photoDay(new Date(2026, 10, 3, 12).getTime())).toBe("3 Nov 2026");
  });
});
