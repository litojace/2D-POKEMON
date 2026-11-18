# Players' pictures in Supabase Storage

Since migration `20261119120000_avatar_photo_storage`, a player's own
picture (docs/hidden-picks.md, "Avatars") is a file in Supabase Storage,
not bytes in the database.

## Why

- The database stays small: Postgres backups, the free plan's 500 MB and
  every query on `arena_avatar_photos` no longer carry up to 64 KB a player.
- Pictures are files: Storage keeps them on S3-like storage priced for
  files, not database disk.
- Reading one no longer goes through PostgREST as base64 (a third larger).

## Design

- **Bucket `avatar-photos`, private.** No policy on `storage.objects`
  mentions it, so `anon` and `authenticated` can't list, read or write
  it. Only the game server does, with `SUPABASE_SERVICE_ROLE_KEY` (the
  service role bypasses RLS). Limits on the bucket itself: 64 KB a file,
  `image/webp` and `image/jpeg` only.
- **Files:** `photos/<id>.webp` or `photos/<id>.jpg`, a new id each upload.
- **`arena_avatar_photos`** keeps id, player, path, type, `hidden` and
  the time. Reports and the admin's review work on these rows as before.
- **Upload** (`POST /api/account/avatar-photo`,
  `apps/server/src/avatar-photos.ts`): the server checks the type, the size
  and the file's first bytes, puts the file in the bucket, then
  `arena_save_avatar_photo` (service role, for the player the server signed
  in) checks the rules (an account, not suspended, not barred after a
  removal) and keeps it. Refused: the file is deleted again. The player's
  old picture's file is deleted.
- **Serving** stays on the game server (`GET /api/avatar-photo/<id>`): it
  reads the row first (`arena_avatar_photo`, never a hidden one), then the
  file. A hidden or removed picture serves the default avatar, at once
  (players' caches aside: 10 minutes, as before).
  - Why not signed URLs: a signed URL works until it expires, even after
    three reports hid the picture, and it can't be taken back. Each URL is
    also new, so phones would download the same picture again and again.
    The server's route costs a little bandwidth (at most 64 KB, cached for
    10 minutes) and keeps hiding immediate.
  - Why not a public bucket: anyone with the address would see a hidden or
    removed picture.
- **Deleting:** an admin's **Remove picture**, a new picture and a
  deleted account (yours, or by an admin) delete the file. If Storage fails
  then, the row is gone anyway, so the file can't be served; the server logs
  `[avatar-photos] couldn't delete`.

## Setting it up

Nothing by hand: the migration makes the bucket (an insert into
`storage.buckets`, as Supabase's "Creating Buckets" guide shows for SQL).
It reaches production with the push to `main` (docs/auto-migrations.md).
The server already has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

To make the bucket by hand instead (or to check it): Supabase dashboard →
**Storage** → **New bucket** → name `avatar-photos`, public off; in the
bucket's upload restrictions, a file size limit of 64 KB and the MIME types
`image/webp, image/jpeg` → create. (The dashboard's labels change now and
then; these are the three settings.) Don't add policies to it.

## Pictures kept in the database before

If `20261119110000` reached production first and players added pictures,
`20261119120000` stops (and the deploy with it) while a picture has no file
in the bucket. Then, with the service key:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/avatar-photos-to-storage.mjs
```

It copies each picture to its place (needs the bucket: make it by hand as
above, or the copy fails), and the migration runs on the next deploy. On
18 Nov 2026 the table didn't exist in production, so this isn't needed if
both migrations go out together.

## Checking after a deploy

1. Dashboard → **Storage**: the bucket `avatar-photos` exists, marked
   private, 64 KB, WebP and JPEG.
2. In the game, with an account: player card → **Avatar** → use your own
   picture. It shows; the bucket now has `photos/<id>.webp` (or `.jpg`).
3. Open `https://<game server>/api/avatar-photo/<id>`: the picture.
   `https://<project>.supabase.co/storage/v1/object/public/avatar-photos/photos/<id>.webp`
   must **not** work (the bucket isn't public).
4. Choose another picture: the old file is gone from the bucket.
5. SQL editor: `select id, path, hidden from arena_avatar_photos;` has no
   image column.
