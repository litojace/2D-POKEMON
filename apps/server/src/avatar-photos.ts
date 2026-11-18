// Players' own pictures in Supabase Storage (docs/avatar-photo-storage.md,
// migration 20261119120000). The bucket is private: only the game server,
// with the service role, reads and writes it. The database keeps who owns
// each picture, where its file is and whether reports hid it; a picture is
// served only after its row says it may be, so hiding or removing one takes
// effect at once (players' caches aside: 10 minutes).
import { randomUUID } from "node:crypto";
import { AccountError, rpcError } from "./accounts.js";

export const AVATAR_PHOTO_BUCKET = "avatar-photos";
export type PhotoType = "image/webp" | "image/jpeg";
export interface AvatarPhotoFile {
  type: PhotoType;
  data: Buffer;
}

/** The parts of a service-role Supabase client this uses (faked in tests). */
export interface PhotoClient {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{
    data: unknown;
    error: { code?: string; message?: string } | null;
    status?: number;
  }>;
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: Buffer,
        options: { contentType: string; upsert: boolean; cacheControl: string },
      ): PromiseLike<{ error: { message: string } | null }>;
      download(
        path: string,
      ): PromiseLike<{ data: Blob | null; error: { message: string } | null }>;
      remove(
        paths: string[],
      ): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

export interface AvatarPhotoStore {
  /**
   * Keeps a player's new picture (already checked to be a small WebP or
   * JPEG): the file goes to the bucket, then the database takes it if the
   * player may have one; their old picture's file is deleted. Returns the
   * avatar, `photo:<id>`.
   */
  save(playerId: string, type: PhotoType, data: Buffer): Promise<string>;
  /** A picture anyone may see, by id. Null when hidden, removed or unknown. */
  read(id: string): Promise<AvatarPhotoFile | null>;
  /** A file by its path (an admin looking at a reported picture). */
  file(path: string, type: PhotoType): Promise<AvatarPhotoFile | null>;
  /** A player's picture file, hidden or not (to delete with the account). */
  pathOf(playerId: string): Promise<string | null>;
  /** Deletes files; a failure is logged, not thrown (no row points there). */
  remove(paths: (string | null | undefined)[]): Promise<void>;
}

const PATH = /^photos\/[0-9a-f-]{36}\.(webp|jpg)$/;
const extOf = (type: PhotoType) => (type === "image/webp" ? "webp" : "jpg");
const isType = (t: unknown): t is PhotoType =>
  t === "image/webp" || t === "image/jpeg";

/** The file is what it says: RIFF....WEBP, or a JPEG's FF D8 FF. */
export function photoLooksRight(type: PhotoType, data: Buffer) {
  if (data.length < 64) return false;
  return type === "image/webp"
    ? data.subarray(0, 4).toString("latin1") === "RIFF" &&
        data.subarray(8, 12).toString("latin1") === "WEBP"
    : data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
}

export function createAvatarPhotoStore(
  client: () => PhotoClient,
): AvatarPhotoStore {
  const bucket = () => client().storage.from(AVATAR_PHOTO_BUCKET);
  const store: AvatarPhotoStore = {
    async save(playerId, type, data) {
      if (!photoLooksRight(type, data))
        throw new AccountError(400, "That picture could not be read.");
      const id = randomUUID();
      const path = `photos/${id}.${extOf(type)}`;
      const up = await bucket().upload(path, data, {
        contentType: type,
        upsert: false,
        cacheControl: "600",
      });
      if (up.error)
        throw new AccountError(
          503,
          "Your picture couldn't be saved. Please try again in a moment.",
          `avatar-photos upload: ${up.error.message}`,
        );
      const saved = await client().rpc("arena_save_avatar_photo", {
        p_player: playerId,
        p_id: id,
        p_type: type,
      });
      if (saved.error) {
        // Refused (a guest, barred) or the database failed: no row points
        // at the file, so it goes.
        await store.remove([path]);
        throw rpcError("arena_save_avatar_photo", saved.error, saved.status);
      }
      const row = saved.data as { avatar?: unknown; old?: unknown } | null;
      if (typeof row?.old === "string") await store.remove([row.old]);
      return typeof row?.avatar === "string" ? row.avatar : `photo:${id}`;
    },
    async read(id) {
      try {
        const r = await client().rpc("arena_avatar_photo", { p_id: id });
        const row = r.data as { type?: unknown; path?: unknown } | null;
        if (
          r.error ||
          !row ||
          !isType(row.type) ||
          typeof row.path !== "string"
        )
          return null;
        return await store.file(row.path, row.type);
      } catch {
        return null;
      }
    },
    async file(path, type) {
      if (!PATH.test(path)) return null;
      try {
        const r = await bucket().download(path);
        if (r.error || !r.data) return null;
        return { type, data: Buffer.from(await r.data.arrayBuffer()) };
      } catch {
        return null;
      }
    },
    async pathOf(playerId) {
      try {
        const r = await client().rpc("arena_avatar_photo_path_of", {
          p_player: playerId,
        });
        return !r.error && typeof r.data === "string" ? r.data : null;
      } catch {
        return null;
      }
    },
    async remove(paths) {
      const files = paths.filter(
        (p): p is string => typeof p === "string" && PATH.test(p),
      );
      if (!files.length) return;
      try {
        const r = await bucket().remove(files);
        if (r.error) throw new Error(r.error.message);
      } catch (error) {
        console.warn(
          `[avatar-photos] couldn't delete ${files.join(", ")}:`,
          error instanceof Error ? error.message : error,
        );
      }
    },
  };
  return store;
}
