// One time, only if needed: copies players' pictures that the database kept
// itself (arena_avatar_photos.image, migration 20261119110000) into the
// Storage bucket avatar-photos, at the place migration 20261119120000
// expects (photos/<id>.webp or .jpg). That migration stops while a picture
// has no file there; run this, then the migration again.
// Safe to run again: a file already there is written over with the same
// bytes. Reads the database through the API with the service role.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/avatar-photos-to-storage.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const rows = await db
  .from("arena_avatar_photos")
  .select("id, content_type, image");
if (rows.error) {
  // 42703: no image column: the pictures moved already.
  if (rows.error.code === "42703") {
    console.log("✓ Nothing to copy: the pictures are in Storage already.");
    process.exit(0);
  }
  console.error(`✗ ${rows.error.message}`);
  process.exit(1);
}
let copied = 0,
  failed = 0;
for (const row of rows.data ?? []) {
  if (typeof row.image !== "string" || !row.image.startsWith("\\x")) continue;
  const data = Buffer.from(row.image.slice(2), "hex");
  const ext = row.content_type === "image/webp" ? "webp" : "jpg";
  const up = await db.storage
    .from("avatar-photos")
    .upload(`photos/${row.id}.${ext}`, data, {
      contentType: row.content_type,
      upsert: true,
      cacheControl: "600",
    });
  if (up.error) {
    failed++;
    console.error(`✗ ${row.id}: ${up.error.message}`);
  } else copied++;
}
console.log(
  `✓ ${copied} picture(s) copied${failed ? `, ✗ ${failed} failed` : ""}.`,
);
process.exit(failed ? 1 : 0);
