begin;
create table if not exists public.arena_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  suspended boolean not null default false,
  equipped_title uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.arena_admins (user_id uuid primary key references auth.users(id) on delete cascade);
create table if not exists public.arena_titles (
  id uuid primary key default gen_random_uuid(), name text not null unique check(char_length(name) between 1 and 40),
  description text not null default '' check(char_length(description)<=160),
  color text not null default '#d5f778' check(color ~ '^#[0-9a-fA-F]{6}$'), active boolean not null default true
);
create table if not exists public.arena_player_titles (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  title_id uuid not null references public.arena_titles(id) on delete cascade,
  primary key(player_id,title_id)
);
create table if not exists public.arena_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id), action text not null, target_id uuid,
  details jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.arena_profiles enable row level security;
alter table public.arena_admins enable row level security;
alter table public.arena_titles enable row level security;
alter table public.arena_player_titles enable row level security;
alter table public.arena_admin_audit enable row level security;
revoke all on public.arena_profiles, public.arena_admins, public.arena_titles, public.arena_player_titles, public.arena_admin_audit from anon, authenticated;

create or replace function public.arena_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.arena_admins a where a.user_id=auth.uid())
 and not exists(select 1 from public.arena_profiles p where p.id=auth.uid() and p.suspended);
$$;
create or replace function public.arena_require_admin() returns void
language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null or not public.arena_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if; end; $$;

create or replace function public.arena_me() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; candidate text;
begin
 if auth.uid() is null then raise exception 'Login required' using errcode='42501'; end if;
 select left(coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'),''),nullif(trim(u.raw_user_meta_data->>'full_name'),''),'Trainer'),20) into candidate from auth.users u where u.id=auth.uid();
 if candidate is null then raise exception 'Account not found' using errcode='42501'; end if;
 insert into public.arena_profiles(id,display_name) values(auth.uid(),candidate) on conflict(id) do nothing;
 select jsonb_build_object('id',p.id,'displayName',p.display_name,'suspended',p.suspended,'isAdmin',public.arena_is_admin(),
 'title',t.name,'titleColor',t.color,'ownedTitles',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'description',o.description,'color',o.color,'active',o.active) order by o.name) from public.arena_titles o join public.arena_player_titles g on g.title_id=o.id where g.player_id=p.id and o.active),'[]'::jsonb)) into result
 from public.arena_profiles p left join public.arena_player_titles g on g.player_id=p.id and g.title_id=p.equipped_title left join public.arena_titles t on t.id=g.title_id and t.active where p.id=auth.uid();
 return result;
end; $$;

create or replace function public.arena_equip_title(p_title_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.arena_profiles where id=auth.uid() and not suspended) then raise exception 'Login required' using errcode='42501'; end if;
 if p_title_id is not null and not exists(select 1 from public.arena_player_titles g join public.arena_titles t on t.id=g.title_id and t.active where g.player_id=auth.uid() and g.title_id=p_title_id) then raise exception 'You do not own this active title' using errcode='42501'; end if;
 update public.arena_profiles set equipped_title=p_title_id where id=auth.uid();
end; $$;

create or replace function public.arena_admin_players(p_search text default '',p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.arena_require_admin();
 if p_offset<0 or p_offset>100000 or char_length(p_search)>80 then raise exception 'Invalid search'; end if;
 select jsonb_build_object('total',(select count(*) from public.arena_profiles p where p.display_name ilike '%'||p_search||'%' or p.id::text=p_search),
 'players',coalesce((select jsonb_agg(rowdata) from (select jsonb_build_object('id',p.id,'displayName',p.display_name,'suspended',p.suspended,'isAdmin',exists(select 1 from public.arena_admins a where a.user_id=p.id),'title',t.name,'createdAt',p.created_at,'titleIds',coalesce((select jsonb_agg(g.title_id) from public.arena_player_titles g where g.player_id=p.id),'[]'::jsonb)) rowdata from public.arena_profiles p left join public.arena_titles t on t.id=p.equipped_title and t.active where p.display_name ilike '%'||p_search||'%' or p.id::text=p_search order by p.created_at desc,p.id limit 50 offset p_offset) rows),'[]'::jsonb)) into result;
 return result;
end; $$;

create or replace function public.arena_admin_update_player(p_player_id uuid,p_display_name text,p_suspended boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.arena_require_admin();
 if p_display_name is null or char_length(trim(p_display_name)) not between 1 and 20 or p_suspended is null then raise exception 'Invalid player settings'; end if;
 if p_suspended and (p_player_id=auth.uid() or exists(select 1 from public.arena_admins where user_id=p_player_id)) then raise exception 'Administrator suspension must be handled in trusted database administration'; end if;
 update public.arena_profiles set display_name=trim(p_display_name),suspended=p_suspended where id=p_player_id;
 if not found then raise exception 'Player not found'; end if;
 insert into public.arena_admin_audit(actor_id,action,target_id,details) values(auth.uid(),'update_player',p_player_id,jsonb_build_object('displayName',trim(p_display_name),'suspended',p_suspended));
end; $$;

create or replace function public.arena_admin_titles() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin perform public.arena_require_admin();
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'description',description,'color',color,'active',active) order by name),'[]'::jsonb) into result from public.arena_titles;
 return result;
end; $$;

create or replace function public.arena_admin_save_title(p_title_id uuid,p_name text,p_description text,p_color text,p_active boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform public.arena_require_admin();
 if p_name is null or char_length(trim(p_name)) not between 1 and 40 or p_description is null or char_length(p_description)>160 or p_color is null or p_color !~ '^#[0-9a-fA-F]{6}$' or p_active is null then raise exception 'Invalid title'; end if;
 if p_title_id is null then insert into public.arena_titles(name,description,color,active) values(trim(p_name),p_description,p_color,p_active) returning id into result;
 else update public.arena_titles set name=trim(p_name),description=p_description,color=p_color,active=p_active where id=p_title_id returning id into result;
 if not found then raise exception 'Title not found'; end if; end if;
 insert into public.arena_admin_audit(actor_id,action,target_id,details) values(auth.uid(),'save_title',result,jsonb_build_object('name',trim(p_name),'active',p_active));
 return result;
end; $$;

create or replace function public.arena_admin_grant_title(p_player_id uuid,p_title_id uuid,p_grant boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.arena_require_admin();
 if p_grant is null then raise exception 'Invalid grant'; end if;
 if not exists(select 1 from public.arena_profiles where id=p_player_id) or not exists(select 1 from public.arena_titles where id=p_title_id) then raise exception 'Player or title not found'; end if;
 if p_grant then insert into public.arena_player_titles(player_id,title_id) values(p_player_id,p_title_id) on conflict do nothing;
 else delete from public.arena_player_titles where player_id=p_player_id and title_id=p_title_id;update public.arena_profiles set equipped_title=null where id=p_player_id and equipped_title=p_title_id; end if;
 insert into public.arena_admin_audit(actor_id,action,target_id,details) values(auth.uid(),'grant_title',p_player_id,jsonb_build_object('titleId',p_title_id,'grant',p_grant));
end; $$;

-- No browser can insert administrators or write account/title tables directly.
revoke all on function public.arena_is_admin(),public.arena_require_admin(),public.arena_me(),public.arena_equip_title(uuid),public.arena_admin_players(text,integer),public.arena_admin_update_player(uuid,text,boolean),public.arena_admin_titles(),public.arena_admin_save_title(uuid,text,text,text,boolean),public.arena_admin_grant_title(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.arena_is_admin(),public.arena_me(),public.arena_equip_title(uuid),public.arena_admin_players(text,integer),public.arena_admin_update_player(uuid,text,boolean),public.arena_admin_titles(),public.arena_admin_save_title(uuid,text,text,text,boolean),public.arena_admin_grant_title(uuid,uuid,boolean) to authenticated;
commit;
