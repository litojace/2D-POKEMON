import type { PhotoClient } from "../../apps/server/src/avatar-photos";

/**
 * A stand-in for the service-role Supabase client behind players' pictures:
 * a private bucket in memory, and the four database functions as small
 * rules (migration 20261119120000). `fail` makes the next upload, save,
 * download or remove fail, to check what the server does then.
 */
export function fakePhotoClient() {
  const files = new Map<string, { type: string; data: Buffer }>();
  const rows = new Map<
    string,
    { user: string; path: string; type: string; hidden: boolean }
  >();
  const refused = new Map<string, string>(); // player -> message
  const fail = new Set<"upload" | "save" | "download" | "remove">();
  const log: string[] = [];
  const client: PhotoClient = {
    async rpc(name, args) {
      log.push(name);
      if (name === "arena_save_avatar_photo") {
        if (fail.delete("save"))
          return { data: null, error: { message: "timeout" }, status: 504 };
        const player = String(args.p_player);
        const why = refused.get(player);
        if (why) return { data: null, error: { code: "42501", message: why } };
        const id = String(args.p_id);
        let old: string | null = null;
        for (const [k, r] of rows)
          if (r.user === player) {
            old = r.path;
            rows.delete(k);
          }
        const ext = args.p_type === "image/webp" ? "webp" : "jpg";
        rows.set(id, {
          user: player,
          path: `photos/${id}.${ext}`,
          type: String(args.p_type),
          hidden: false,
        });
        return { data: { avatar: `photo:${id}`, old }, error: null };
      }
      if (name === "arena_avatar_photo") {
        const r = rows.get(String(args.p_id));
        return {
          data: r && !r.hidden ? { type: r.type, path: r.path } : null,
          error: null,
        };
      }
      if (name === "arena_avatar_photo_path_of") {
        const r = [...rows.values()].find((r) => r.user === args.p_player);
        return { data: r?.path ?? null, error: null };
      }
      return { data: null, error: { message: `no ${name}` } };
    },
    storage: {
      from(bucket) {
        if (bucket !== "avatar-photos") throw Error(`bucket ${bucket}`);
        return {
          async upload(path, body, options) {
            log.push(`upload ${path}`);
            if (fail.delete("upload"))
              return { error: { message: "Storage is down" } };
            if (files.has(path) && !options.upsert)
              return { error: { message: "The resource already exists" } };
            files.set(path, { type: options.contentType, data: body });
            return { error: null };
          },
          async download(path) {
            if (fail.delete("download"))
              return { data: null, error: { message: "Storage is down" } };
            const f = files.get(path);
            return f
              ? { data: new Blob([new Uint8Array(f.data)]), error: null }
              : { data: null, error: { message: "Object not found" } };
          },
          async remove(paths) {
            log.push(`remove ${paths.join(",")}`);
            if (fail.delete("remove"))
              return { error: { message: "Storage is down" } };
            for (const p of paths) files.delete(p);
            return { error: null };
          },
        };
      },
    },
  };
  return { client, files, rows, refused, fail, log };
}

export const webpBytes = (size = 3000) =>
  Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.alloc(4),
    Buffer.from("WEBPVP8 "),
    Buffer.alloc(size, 1),
  ]);
export const jpegBytes = (size = 3000) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(size, 9)]);
