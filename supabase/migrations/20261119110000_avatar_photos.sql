-- Your own picture as your avatar (docs/hidden-picks.md, "Avatars"): a
-- photo from your phone, cut to a 256 px square on your device, seen by
-- everyone. Run after 20261119100000_player_avatars.sql. Safe to run again.
--
--   - arena_avatar_photos: one picture per player (WebP or JPEG, at most
--     64 KB: the device sends 256 x 256), each upload a new id, the old one
--     gone. No player reads the table; the game server serves pictures by
--     id (arena_avatar_photo, service role), hidden ones not at all;
--   - arena_profiles.avatar may be 'photo:<id>': the player wears it;
--   - arena_set_avatar_photo(p_image, p_type): a player (not a guest, not
--     suspended, not barred from pictures) sets their own;
--   - arena_report_avatar_photo(p_photo, p_message): any player reports a
--     picture once; a report for the admins (arena_reports, 'player'), and
--     at three reporters the picture is hidden until an admin looks;
--   - arena_admin_avatar_photo(p_photo, p_keep): an admin keeps it (shown
--     again, its reports cleared) or removes it (gone; the player is back
--     on the default, and may not upload again for 7 days).

begin;

create table if not exists public.arena_avatar_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.arena_profiles(id) on delete cascade,
  image bytea not null check (octet_length(image) between 64 and 65536),
  content_type text not null check (content_type in ('image/webp', 'image/jpeg')),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.arena_avatar_photos enable row level security;
revoke all on public.arena_avatar_photos from anon, authenticated;

create table if not exists public.arena_avatar_photo_reports (
  photo_id uuid not null references public.arena_avatar_photos(id) on delete cascade,
  reporter_id uuid not null references public.arena_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, reporter_id)
);
alter table public.arena_avatar_photo_reports enable row level security;
revoke all on public.arena_avatar_photo_reports from anon, authenticated;

alter table public.arena_profiles add column if not exists photo_barred_until timestamptz;

-- A library avatar, or your picture ('photo:' and its id).
alter table public.arena_profiles drop constraint if exists arena_profiles_avatar_check;
alter table public.arena_profiles add constraint arena_profiles_avatar_check
  check (avatar is null
    or avatar ~ '^ea-avatar-0(0[1-9]|[1-4][0-9]|5[0-2])$'
    or avatar ~ '^photo:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

create or replace function public.arena_set_avatar_photo(p_image text, p_type text) returns text
language plpgsql security definer set search_path = '' as $$
declare bytes bytea; me public.arena_profiles; new_id uuid;
begin
 perform public.arena_require_player();
 select * into me from public.arena_profiles where id = auth.uid();
 if me.guest then
  raise exception 'Make an account to use your own picture.' using errcode = '42501';
 end if;
 if me.photo_barred_until is not null and me.photo_barred_until > now() then
  raise exception 'Your last picture was removed. You can add one again in a few days.' using errcode = '42501';
 end if;
 if p_type is null or p_type not in ('image/webp', 'image/jpeg') then
  raise exception 'Use a WebP or JPEG picture.' using errcode = '22023';
 end if;
 begin
  bytes := decode(p_image, 'base64');
 exception when others then
  raise exception 'That picture could not be read.' using errcode = '22023';
 end;
 if bytes is null or octet_length(bytes) not between 64 and 65536 then
  raise exception 'That picture is too large.' using errcode = '22023';
 end if;
 -- The file is what it says: RIFF....WEBP, or a JPEG's FF D8 FF.
 if (p_type = 'image/webp' and (substring(bytes from 1 for 4) <> '\x52494646'::bytea
      or substring(bytes from 9 for 4) <> '\x57454250'::bytea))
   or (p_type = 'image/jpeg' and substring(bytes from 1 for 3) <> '\xffd8ff'::bytea) then
  raise exception 'That picture could not be read.' using errcode = '22023';
 end if;
 delete from public.arena_avatar_photos where user_id = auth.uid();
 insert into public.arena_avatar_photos(user_id, image, content_type)
 values (auth.uid(), bytes, p_type) returning id into new_id;
 update public.arena_profiles set avatar = 'photo:' || new_id where id = auth.uid();
 return 'photo:' || new_id;
end; $$;
revoke all on function public.arena_set_avatar_photo(text, text) from public, anon;
grant execute on function public.arena_set_avatar_photo(text, text) to authenticated;

-- A picture by id, for the game server to serve (never a hidden one).
create or replace function public.arena_avatar_photo(p_id uuid) returns jsonb
language sql security definer set search_path = '' stable as $$
 select jsonb_build_object('type', content_type, 'data', encode(image, 'base64'))
 from public.arena_avatar_photos where id = p_id and not hidden;
$$;
revoke all on function public.arena_avatar_photo(uuid) from public, anon, authenticated;
grant execute on function public.arena_avatar_photo(uuid) to service_role;

create or replace function public.arena_report_avatar_photo(p_photo uuid, p_message text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner uuid; owner_name text; reporters int; already boolean;
begin
 perform public.arena_require_player();
 select ph.user_id, p.display_name into owner, owner_name
 from public.arena_avatar_photos ph join public.arena_profiles p on p.id = ph.user_id
 where ph.id = p_photo;
 if owner is null then raise exception 'That picture is gone already.' using errcode = 'P0002'; end if;
 if owner = auth.uid() then raise exception 'That is your own picture.' using errcode = '22023'; end if;
 select exists(select 1 from public.arena_avatar_photo_reports
   where photo_id = p_photo and reporter_id = auth.uid()) into already;
 if not already then
  insert into public.arena_avatar_photo_reports(photo_id, reporter_id) values (p_photo, auth.uid());
  -- Always a readable report (the reports table wants 5 to 1000 letters).
  perform public.arena_submit_report('player',
    left('Picture reported' || coalesce(': ' || nullif(trim(p_message), ''), '.'), 1000),
    jsonb_build_object('avatarPhoto', p_photo, 'playerId', owner, 'playerName', owner_name));
 end if;
 select count(*) into reporters from public.arena_avatar_photo_reports where photo_id = p_photo;
 if reporters >= 3 then
  update public.arena_avatar_photos set hidden = true where id = p_photo;
 end if;
 return jsonb_build_object('reported', true, 'hidden', reporters >= 3);
end; $$;
revoke all on function public.arena_report_avatar_photo(uuid, text) from public, anon;
grant execute on function public.arena_report_avatar_photo(uuid, text) to authenticated;

-- An admin looks at a reported picture: keep it, or remove it.
drop function if exists public.arena_admin_avatar_photo(uuid, boolean);
create or replace function public.arena_admin_avatar_photo(p_photo uuid, p_keep boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
 perform public.arena_require_admin();
 select user_id into owner from public.arena_avatar_photos where id = p_photo;
 if owner is null then return null; end if;
 if p_keep then
  update public.arena_avatar_photos set hidden = false where id = p_photo;
  delete from public.arena_avatar_photo_reports where photo_id = p_photo;
 else
  delete from public.arena_avatar_photos where id = p_photo;
  update public.arena_profiles
  set avatar = null, photo_barred_until = now() + interval '7 days'
  where id = owner;
 end if;
 return owner;
end; $$;
revoke all on function public.arena_admin_avatar_photo(uuid, boolean) from public, anon;
grant execute on function public.arena_admin_avatar_photo(uuid, boolean) to authenticated;

-- An admin sees the picture itself in the report (hidden or not).
create or replace function public.arena_admin_avatar_photo_image(p_photo uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 perform public.arena_require_admin();
 select jsonb_build_object('type', content_type, 'data', encode(image, 'base64'), 'hidden', hidden)
 into result from public.arena_avatar_photos where id = p_photo;
 return result;
end; $$;
revoke all on function public.arena_admin_avatar_photo_image(uuid) from public, anon;
grant execute on function public.arena_admin_avatar_photo_image(uuid) to authenticated;

commit;
notify pgrst, 'reload schema';
