-- Players' pictures move out of the database into Supabase Storage
-- (docs/hidden-picks.md, "Avatars"; docs/avatar-photo-storage.md). Run after
-- 20261119110000_avatar_photos.sql. Safe to run again.
--
--   - the bucket 'avatar-photos': private (no policy on storage.objects, so
--     only the service role, i.e. the game server, reads or writes it), at
--     most 64 KB a file, WebP or JPEG only. Objects are photos/<id>.webp|jpg;
--   - arena_avatar_photos keeps only who, where and whether it is hidden: the
--     image bytes column goes. (On 18 Nov 2026 the table did not exist in
--     production yet. Should pictures be kept there first, this file stops
--     until scripts/avatar-photos-to-storage.mjs has copied them.)
--   - the game server stores a picture itself (arena_save_avatar_photo,
--     service role, with the player's id it checked), after the upload;
--   - the same rules as before: accounts only, not suspended, not barred
--     from pictures; three reporters hide one; an admin keeps or removes it,
--     and a removed picture bars its player for 7 days. A hidden or removed
--     picture is never served: the server reads the row before the file.

begin;

-- The bucket. storage.buckets exists on Supabase only (not in the PGlite
-- checks, where there is no Storage).
do $$
begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatar-photos', 'avatar-photos', false, 65536, array['image/webp', 'image/jpeg'])
  on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
 end if;
end $$;

-- Where the file is, in place of the file.
alter table public.arena_avatar_photos add column if not exists path text;
do $$
declare missing boolean;
begin
 if exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'arena_avatar_photos'
              and column_name = 'image') then
  -- A picture kept in the database has its file at a fixed place.
  update public.arena_avatar_photos
  set path = 'photos/' || id::text || case content_type when 'image/webp' then '.webp' else '.jpg' end
  where path is null;
  -- Never drop a picture silently: if one has no file in the bucket yet,
  -- stop here (nothing of this file is applied) so it can be copied first
  -- with scripts/avatar-photos-to-storage.mjs.
  if exists (select 1 from public.arena_avatar_photos) then
   if to_regclass('storage.objects') is null then
    raise exception 'arena_avatar_photos holds pictures but there is no Storage to move them to.';
   end if;
   execute $q$select exists (select 1 from public.arena_avatar_photos ph
     where not exists (select 1 from storage.objects o
       where o.bucket_id = 'avatar-photos' and o.name = ph.path))$q$ into missing;
   if missing then
    raise exception 'Some pictures in arena_avatar_photos are not in the avatar-photos bucket yet: run node scripts/avatar-photos-to-storage.mjs, then this migration again (docs/avatar-photo-storage.md).';
   end if;
  end if;
  alter table public.arena_avatar_photos drop column image;
 end if;
end $$;
alter table public.arena_avatar_photos alter column path set not null;
alter table public.arena_avatar_photos drop constraint if exists arena_avatar_photos_path_check;
alter table public.arena_avatar_photos add constraint arena_avatar_photos_path_check
  check (path = 'photos/' || id::text || case content_type when 'image/webp' then '.webp' else '.jpg' end);

-- Players no longer send the bytes to the database.
drop function if exists public.arena_set_avatar_photo(text, text);

-- The game server keeps a picture it has just put in the bucket. Returns
-- the new avatar and the old picture's file, for the server to delete.
create or replace function public.arena_save_avatar_photo(p_player uuid, p_id uuid, p_type text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.arena_profiles; old_path text; new_path text;
begin
 select * into me from public.arena_profiles where id = p_player;
 if me.id is null or me.suspended then
  raise exception 'Login required' using errcode = '42501';
 end if;
 if me.guest then
  raise exception 'Make an account to use your own picture.' using errcode = '42501';
 end if;
 if me.photo_barred_until is not null and me.photo_barred_until > now() then
  raise exception 'Your last picture was removed. You can add one again in a few days.' using errcode = '42501';
 end if;
 if p_id is null or p_type is null or p_type not in ('image/webp', 'image/jpeg') then
  raise exception 'Use a WebP or JPEG picture.' using errcode = '22023';
 end if;
 new_path := 'photos/' || p_id::text || case p_type when 'image/webp' then '.webp' else '.jpg' end;
 delete from public.arena_avatar_photos where user_id = p_player returning path into old_path;
 insert into public.arena_avatar_photos(id, user_id, path, content_type)
 values (p_id, p_player, new_path, p_type);
 update public.arena_profiles set avatar = 'photo:' || p_id where id = p_player;
 return jsonb_build_object('avatar', 'photo:' || p_id, 'old', old_path);
end; $$;
revoke all on function public.arena_save_avatar_photo(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.arena_save_avatar_photo(uuid, uuid, text) to service_role;

-- A picture's file by id, for the game server to serve (never a hidden one).
create or replace function public.arena_avatar_photo(p_id uuid) returns jsonb
language sql security definer set search_path = '' stable as $$
 select jsonb_build_object('type', content_type, 'path', path)
 from public.arena_avatar_photos where id = p_id and not hidden;
$$;
revoke all on function public.arena_avatar_photo(uuid) from public, anon, authenticated;
grant execute on function public.arena_avatar_photo(uuid) to service_role;

-- A player's picture file (hidden or not), for deleting it with the account.
create or replace function public.arena_avatar_photo_path_of(p_player uuid) returns text
language sql security definer set search_path = '' stable as $$
 select path from public.arena_avatar_photos where user_id = p_player;
$$;
revoke all on function public.arena_avatar_photo_path_of(uuid) from public, anon, authenticated;
grant execute on function public.arena_avatar_photo_path_of(uuid) to service_role;

-- An admin keeps or removes a reported picture. Returns its owner and, when
-- removed, its file for the server to delete.
drop function if exists public.arena_admin_avatar_photo(uuid, boolean);
create function public.arena_admin_avatar_photo(p_photo uuid, p_keep boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner uuid; file text;
begin
 perform public.arena_require_admin();
 select user_id, path into owner, file from public.arena_avatar_photos where id = p_photo;
 if owner is null then return null; end if;
 if p_keep then
  update public.arena_avatar_photos set hidden = false where id = p_photo;
  delete from public.arena_avatar_photo_reports where photo_id = p_photo;
  return jsonb_build_object('owner', owner, 'path', null);
 end if;
 delete from public.arena_avatar_photos where id = p_photo;
 update public.arena_profiles
 set avatar = null, photo_barred_until = now() + interval '7 days'
 where id = owner;
 return jsonb_build_object('owner', owner, 'path', file);
end; $$;
revoke all on function public.arena_admin_avatar_photo(uuid, boolean) from public, anon;
grant execute on function public.arena_admin_avatar_photo(uuid, boolean) to authenticated;

-- An admin sees the picture in the report (hidden or not): its file, which
-- the server reads from the bucket.
create or replace function public.arena_admin_avatar_photo_image(p_photo uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 perform public.arena_require_admin();
 select jsonb_build_object('type', content_type, 'path', path, 'hidden', hidden)
 into result from public.arena_avatar_photos where id = p_photo;
 return result;
end; $$;
revoke all on function public.arena_admin_avatar_photo_image(uuid) from public, anon;
grant execute on function public.arena_admin_avatar_photo_image(uuid) to authenticated;

commit;
notify pgrst, 'reload schema';
