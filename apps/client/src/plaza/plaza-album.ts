/**
 * The Plaza photo album: polaroids you chose to keep, on this device only
 * (IndexedDB). Nothing here goes to the game server: the photos show other
 * players, and keeping them on a server is a cost and privacy decision for
 * the owner (docs/hub-redesign/PLAN.md). The newest ALBUM_LIMIT photos are
 * kept; adding one past the limit removes the oldest in the same
 * transaction, so two tabs saving at once still end at the limit.
 */

/** How many photos the album keeps. */
export const ALBUM_LIMIT = 30;
/** The photo's size in pixels (the polaroid's canvas). */
export const PHOTO_SIZE = { width: 640, height: 420 } as const;
/** The grid's copy: twice its largest cell (128 × 84 CSS pixels). */
export const THUMB_SIZE = { width: 256, height: 168 } as const;

const DB_NAME = "elemental-plaza-album";
const STORE = "photos";

export interface AlbumPhoto {
  /** Grows with every photo: a newer photo always has a larger id. */
  id: number;
  /** When it was taken (ms since 1970, device clock: only shown). */
  at: number;
  /** Who was in it, as written on the polaroid. */
  caption: string;
  /** The polaroid's second line, e.g. "Elemental Plaza · 10:04". */
  place: string;
  /** The photo (JPEG). */
  image: Blob;
  /** A small copy for the grid (JPEG). */
  thumb: Blob;
}
export type NewAlbumPhoto = Omit<AlbumPhoto, "id">;

export interface AlbumAdd {
  id: number;
  /** Photos in the album now (never more than the limit). */
  count: number;
  /** How many of the oldest were removed to make room. */
  dropped: number;
}

export interface PlazaAlbum {
  /** Keep a photo; past the limit the oldest make room. */
  add(photo: NewAlbumPhoto): Promise<AlbumAdd>;
  /** Every photo, newest first. */
  list(): Promise<AlbumPhoto[]>;
  get(id: number): Promise<AlbumPhoto | undefined>;
  remove(id: number): Promise<void>;
  count(): Promise<number>;
  /** Let go of the database connection (the next call opens it again). */
  close(): void;
}

export interface AlbumOptions {
  /** The IndexedDB to use (tests pass their own); the browser's by default. */
  factory?: IDBFactory;
  /** The database name (tests); "elemental-plaza-album" by default. */
  name?: string;
  /** How many photos to keep; ALBUM_LIMIT by default. */
  limit?: number;
}

const result = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
const committed = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new DOMException("Album write aborted", "AbortError"));
  });

export function openAlbum(options: AlbumOptions = {}): PlazaAlbum {
  const name = options.name ?? DB_NAME;
  const limit = Math.max(1, Math.floor(options.limit ?? ALBUM_LIMIT));
  let connection: Promise<IDBDatabase> | undefined;

  function db(): Promise<IDBDatabase> {
    if (connection) return connection;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const factory = options.factory ?? globalThis.indexedDB;
      if (!factory) return reject(new Error("IndexedDB is not available"));
      let request: IDBOpenDBRequest;
      try {
        request = factory.open(name, 1);
      } catch (error) {
        // Some private modes throw here instead of failing the request.
        return reject(error);
      }
      request.onupgradeneeded = () =>
        request.result.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
      request.onsuccess = () => {
        const open = request.result;
        // Another tab upgrading the database: step aside and reopen later.
        open.onversionchange = () => {
          open.close();
          if (connection === opening) connection = undefined;
        };
        resolve(open);
      };
      request.onerror = () => reject(request.error);
    });
    connection = opening;
    // A failed open is not remembered: the next call tries again.
    opening.catch(() => {
      if (connection === opening) connection = undefined;
    });
    return opening;
  }

  return {
    async add(photo) {
      const record = {
        at: photo.at,
        caption: photo.caption,
        place: photo.place,
        image: photo.image,
        thumb: photo.thumb,
      };
      const tx = (await db()).transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const out: AlbumAdd = { id: 0, count: 0, dropped: 0 };
      // Callbacks, not awaits, inside the transaction: it must stay open
      // from the add to the last removal.
      const added = store.add(record);
      added.onsuccess = () => {
        out.id = added.result as number;
        const counted = store.count();
        counted.onsuccess = () => {
          let extra = counted.result - limit;
          out.count = Math.min(counted.result, limit);
          if (extra <= 0) return;
          // Oldest first (smallest id); the new photo has the largest.
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const at = cursor.result;
            if (!at || extra <= 0) return;
            at.delete();
            out.dropped++;
            extra--;
            at.continue();
          };
        };
      };
      await committed(tx);
      return out;
    },
    async list() {
      const store = (await db()).transaction(STORE).objectStore(STORE);
      const all = (await result(store.getAll())) as AlbumPhoto[];
      return all.reverse();
    },
    async get(id) {
      const store = (await db()).transaction(STORE).objectStore(STORE);
      return (await result(store.get(id))) as AlbumPhoto | undefined;
    },
    async remove(id) {
      const tx = (await db()).transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      await committed(tx);
    },
    async count() {
      const store = (await db()).transaction(STORE).objectStore(STORE);
      return result(store.count());
    },
    close() {
      const open = connection;
      connection = undefined;
      open?.then((d) => d.close()).catch(() => {});
    },
  };
}

/** The file name when a photo is saved as a picture (local time). */
export function pictureName(at: number): string {
  const d = new Date(at),
    two = (n: number) => String(n).padStart(2, "0");
  return `elemental-plaza-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}.jpg`;
}

/** The day a photo was taken, in English: "3 Nov 2026". */
export function photoDay(at: number): string {
  return new Date(at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** A canvas as a JPEG (browser only). */
export function canvasJpeg(
  canvas: HTMLCanvasElement,
  quality = 0.9,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("The photo couldn't be made")),
      "image/jpeg",
      quality,
    ),
  );
}

/** The photo and its grid copy, from the polaroid's canvas (browser only). */
export async function albumImages(
  photo: HTMLCanvasElement,
): Promise<{ image: Blob; thumb: Blob }> {
  const small = document.createElement("canvas");
  small.width = THUMB_SIZE.width;
  small.height = THUMB_SIZE.height;
  const g = small.getContext("2d");
  if (!g) throw new Error("The photo couldn't be made");
  g.imageSmoothingQuality = "high";
  g.drawImage(photo, 0, 0, small.width, small.height);
  const [image, thumb] = await Promise.all([
    canvasJpeg(photo, 0.9),
    canvasJpeg(small, 0.85),
  ]);
  return { image, thumb };
}
