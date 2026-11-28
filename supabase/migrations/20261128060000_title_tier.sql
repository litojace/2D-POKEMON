-- A title's tier, chosen by the administrator who makes it (owner, 27 Nov
-- 2026): Common, Rare, Epic, Legendary or Mythical, the same five steps the
-- game's own titles get by rule (packages/shared/src/title-tier.ts). The
-- tier decides how the title is lettered over heads in the Plaza, on the
-- player card, in the Lobby's corner and in the Profile.
--
-- Additive, and safe to run again: one new column with a default (existing
-- titles, the admin-made ones included, stay Common), the save function with
-- one more optional argument, the admin's list with the new field, and one
-- read-only function for the game.
begin;

alter table public.arena_titles
  add column if not exists tier text not null default 'common';
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'arena_titles_tier_check'
      and conrelid = 'public.arena_titles'::regclass
  ) then
    alter table public.arena_titles
      add constraint arena_titles_tier_check
      check (tier in ('common', 'rare', 'epic', 'legendary', 'mythic'));
  end if;
end $$;

-- Save a title, with its tier. `p_tier` null keeps the tier a title has
-- (Common for a new one), so a game server from before this migration,
-- which sends five arguments, changes nothing it doesn't know about.
-- The five-argument function goes, so a call by name has one candidate.
drop function if exists public.arena_admin_save_title(uuid, text, text, text, boolean);
create or replace function public.arena_admin_save_title(
  p_title_id uuid,
  p_name text,
  p_description text,
  p_color text,
  p_active boolean,
  p_tier text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform public.arena_require_admin();
  if p_name is null or char_length(trim(p_name)) not between 1 and 40
    or p_description is null or char_length(p_description) > 160
    or p_color is null or p_color !~ '^#[0-9a-fA-F]{6}$'
    or p_active is null
    or (p_tier is not null and p_tier not in ('common', 'rare', 'epic', 'legendary', 'mythic'))
  then raise exception 'Invalid title'; end if;
  if p_title_id is null then
    insert into public.arena_titles(name, description, color, active, tier)
    values (trim(p_name), p_description, p_color, p_active, coalesce(p_tier, 'common'))
    returning id into result;
  else
    update public.arena_titles
    set name = trim(p_name), description = p_description, color = p_color,
        active = p_active, tier = coalesce(p_tier, tier)
    where id = p_title_id
    returning id into result;
    if not found then raise exception 'Title not found'; end if;
  end if;
  insert into public.arena_admin_audit(actor_id, action, target_id, details)
  values (auth.uid(), 'save_title', result,
    jsonb_build_object('name', trim(p_name), 'active', p_active,
      'tier', (select tier from public.arena_titles where id = result)));
  return result;
end; $$;
revoke all on function public.arena_admin_save_title(uuid, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.arena_admin_save_title(uuid, text, text, text, boolean, text) to authenticated;

-- The admin's list of titles, with each one's tier.
create or replace function public.arena_admin_titles() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.arena_require_admin();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'description', description, 'color', color,
    'active', active, 'createdAt', created_at, 'tier', tier
  ) order by created_at desc, name), '[]'::jsonb)
  into result from public.arena_titles;
  return result;
end; $$;

-- For the game: the titles an administrator gave a tier above Common, as
-- {"name": "tier"}. Names and tiers only: nothing about who holds them.
create or replace function public.arena_title_tiers() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(name, tier), '{}'::jsonb)
  from public.arena_titles where tier <> 'common'
$$;
revoke all on function public.arena_title_tiers() from public, anon, authenticated;
grant execute on function public.arena_title_tiers() to authenticated;

commit;
notify pgrst, 'reload schema';
