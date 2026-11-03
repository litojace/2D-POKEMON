-- Sixteen champions: Coilemur, Pyranda, Glacelle, Halcyra, Sunbara, Astrabun,
-- Wombolder and Shadopus join the eight originals everywhere SQL names the
-- champions. Without this, choosing one of them as your portrait, or playing
-- one (your Lobby fighter is your farmer), is refused.
--
--  * arena_champion_ids(): the roster in one place. Functions check against it,
--    so a later copy of one of them keeps the whole roster.
--  * Portrait champion (033) and farmer (046): the checks and the setters.
--  * Farm orders (040): the new champions place orders too.
--  * The new champions have no farm perk yet: as farmers they farm with none
--    (FARM_PERKS in packages/shared/src/farm.ts lists the eight perks).
begin;

create or replace function public.arena_champion_ids() returns text[]
language sql immutable set search_path = '' as $$
  select array['voltkit','cindrake','tidefin','auralynx','lumoth','mystowl','terradon','duskveil','coilemur','pyranda','glacelle','halcyra','sunbara','astrabun','wombolder','shadopus']::text[]
$$;

alter table public.arena_profiles drop constraint if exists arena_profiles_portrait_character_check;
alter table public.arena_profiles add constraint arena_profiles_portrait_character_check
  check (portrait_character in ('voltkit','cindrake','tidefin','auralynx','lumoth','mystowl','terradon','duskveil','coilemur','pyranda','glacelle','halcyra','sunbara','astrabun','wombolder','shadopus'));
alter table public.arena_farms drop constraint if exists arena_farms_farmer_check;
alter table public.arena_farms add constraint arena_farms_farmer_check
  check (farmer in ('voltkit','cindrake','tidefin','auralynx','lumoth','mystowl','terradon','duskveil','coilemur','pyranda','glacelle','halcyra','sunbara','astrabun','wombolder','shadopus'));

-- As in 033, with the whole roster.
create or replace function public.arena_set_portrait_character(p_character text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.arena_require_player();
 if p_character is null or not (p_character = any (public.arena_champion_ids())) then
   raise exception 'Choose a valid champion';
 end if;
 update public.arena_profiles set portrait_character=p_character
   where id=auth.uid() and portrait_character is distinct from p_character;
end; $$;
revoke all on function public.arena_set_portrait_character(text) from public, anon, authenticated;
grant execute on function public.arena_set_portrait_character(text) to authenticated;

-- As in 040, with sixteen places and faces.
create or replace function public.arena_farm_new_order(pid uuid, p_slot integer, p_level integer) returns void
language plpgsql security definer set search_path = public as $$
declare pool text[]; kinds integer; used text[] = '{}'; pick text; c public.arena_farm_crops;
  items jsonb = '[]'::jsonb; n integer; val integer = 0; v_xp integer = 0; r integer;
begin
  pool = array(select id from public.arena_farm_crops where level <= greatest(1, p_level) order by level, id);
  kinds = 1 + floor(random() * least(3, array_length(pool, 1)))::integer;
  for k in 1..kinds loop
    loop
      pick = pool[1 + floor(random() * array_length(pool, 1))::integer];
      exit when not pick = any(used);
    end loop;
    used = used || pick;
    select * into c from public.arena_farm_crops where id = pick;
    n = 2 + floor(random() * (case when c.level > 4 then 4 else 7 end))::integer;
    items = items || jsonb_build_array(jsonb_build_array(c.id, n));
    val = val + c.sell * n;
    v_xp = v_xp + c.xp * n;
  end loop;
  r = 1 + floor(random() * 16)::integer;
  insert into public.arena_farm_orders(player_id, slot, items, leaves, xp, bonus, who, face, wait_until)
  values (pid, p_slot, items, (round(val * 1.45 / 5) * 5)::integer, v_xp,
    case when random() < 0.3 then (array['super', 'gold', 'norm'])[1 + floor(random() * 3)::integer] end,
    (array['Volt Boba Truck', 'Raid Hall', 'Cindrake''s Forge', 'Mystowl''s Library',
      'Tidefin''s Kitchen', 'Lumoth''s Shrine', 'Terradon''s Quarry', 'Shadow Guild',
      'Coilemur''s Coil Shop', 'Pyranda''s Chestnut Cart', 'Glacelle''s Ice Parlour', 'Halcyra''s Lookout',
      'Sunbara''s Hot Spring', 'Astrabun''s Mochi Bakery', 'Wombolder''s Burrow', 'Shadopus''s Ink Den'])[r],
    (array['voltkit', 'auralynx', 'cindrake', 'mystowl', 'tidefin', 'lumoth', 'terradon', 'duskveil',
      'coilemur', 'pyranda', 'glacelle', 'halcyra', 'sunbara', 'astrabun', 'wombolder', 'shadopus'])[r],
    null)
  on conflict (player_id, slot) do update set items = excluded.items, leaves = excluded.leaves,
    xp = excluded.xp, bonus = excluded.bonus, who = excluded.who, face = excluded.face, wait_until = null;
end; $$;
-- Fill empty slots and slots whose wait is over.
create or replace function public.arena_farm_orders_refresh(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare lvl integer = coalesce((select level from public.arena_farms where player_id = pid), 1);
begin
  for s in 0..2 loop
    if not exists (select 1 from public.arena_farm_orders where player_id = pid and slot = s)
       or exists (select 1 from public.arena_farm_orders where player_id = pid and slot = s
         and items is null and wait_until <= now()) then
      perform public.arena_farm_new_order(pid, s, lvl);
    end if;
  end loop;
end; $$;
revoke all on function public.arena_farm_new_order(uuid, integer, integer) from public, anon, authenticated, service_role;

-- As in 049 (its latest version), with the whole roster as farmers.
create or replace function public.arena_farm_act_more(pid uuid, a jsonb, ref text, t timestamptz, d date,
  out err text, out gained jsonb, out xp integer)
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; v_dog text; v_days integer; cost integer; v_level integer;
  cur public.arena_farm_dog_hires; plot integer; p public.arena_farm_plots; v_perk text;
  inserted integer; n integer; v_plots jsonb; s record; v_item public.arena_farm_decor_items;
begin
  xp = 0;
  select * into f from public.arena_farms where player_id = pid;
  if a->>'a' = 'hire-dog' then
    v_dog = a->>'dog';
    v_days = case when jsonb_typeof(a->'days') = 'number' then (a->>'days')::integer end;
    v_level = case v_dog when 'gold' then 3 when 'black' then 20 when 'cream' then 40 end;
    cost = case when v_days = 1 then case v_dog when 'gold' then 60 when 'black' then 180 when 'cream' then 300 end
      when v_days = 3 then case v_dog when 'gold' then 150 when 'black' then 450 when 'cream' then 750 end end;
    select * into cur from public.arena_farm_dog_hires h
     where h.player_id = pid and h.started_at <= t and h.ends_at > t order by h.ends_at desc limit 1 for update;
    if v_level is null then err = 'Unknown dog';
    elsif cost is null then err = 'Hire for 1 or 3 days';
    elsif f.level < v_level then err = 'Unlocks at farm level ' || v_level;
    elsif cur.dog = v_dog and cur.ends_at + make_interval(days => v_days) > t + interval '30 days' then
      err = 'That is as long as a dog can be booked';
    elsif not public.arena_spend_leaves(pid, cost, 'farm-dog', ref, d) then err = 'Not enough Gold Leaves';
    elsif cur.dog = v_dog then
      update public.arena_farm_dog_hires set ends_at = ends_at + make_interval(days => v_days) where id = cur.id;
      gained = jsonb_build_object('dog', v_dog, 'days', v_days, 'cost', cost, 'extended', true);
    else
      if cur.id is not null then
        update public.arena_farm_dog_hires set ends_at = t, dug_at = least(dug_at, t) where id = cur.id;
      end if;
      insert into public.arena_farm_dog_hires(player_id, dog, started_at, ends_at, dug_at)
      values (pid, v_dog, t, t + make_interval(days => v_days), t);
      gained = jsonb_build_object('dog', v_dog, 'days', v_days, 'cost', cost, 'extended', false);
    end if;
  elsif a->>'a' = 'shoo' then
    plot = case when jsonb_typeof(a->'plot') = 'number' then (a->>'plot')::integer end;
    select * into p from public.arena_farm_plots where player_id = pid and idx = plot for update;
    if p.idx is null then err = 'Unknown plot';
    elsif p.crow_at is null then err = 'No crow here';
    else
      update public.arena_farm_plots set crow_at = null where player_id = pid and idx = plot;
      gained = jsonb_build_object('shooed', true);
    end if;
  elsif a->>'a' = 'farmer' then
    if a->>'id' is null or not (a->>'id' = any (public.arena_champion_ids())) then
      err = 'Choose a valid champion';
    else
      if f.farmer is distinct from a->>'id' then
        perform public.arena_farm_rebase(pid, t);
        update public.arena_farms set farmer = a->>'id' where player_id = pid;
      end if;
      gained = jsonb_build_object('farmer', a->>'id');
    end if;
  elsif a->>'a' = 'perk' then
    v_perk = case f.farmer when 'voltkit' then 'zap' when 'tidefin' then 'downpour' when 'cindrake' then 'warmth' end;
    if v_perk is null then err = 'Your farmer''s perk is always on';
    else
      insert into public.arena_farm_perk_uses(player_id, perk, day) values (pid, v_perk, d) on conflict do nothing;
      get diagnostics inserted = row_count;
      if inserted = 0 then err = 'Already used today. It''s back tomorrow';
      elsif v_perk = 'zap' then
        n = 0;
        for p in select * from public.arena_farm_plots where player_id = pid and pests > 0 order by idx loop
          n = n + p.pests;
          perform public.arena_farm_set_pests(pid, p.idx, 0, t);
        end loop;
        gained = jsonb_build_object('perk', 'zap', 'cleared', n);
      elsif v_perk = 'downpour' then
        v_plots = '[]'::jsonb;
        for p in select * from public.arena_farm_plots where player_id = pid and owned and crop is not null
            order by idx for update loop
          select * into s from public.arena_farm_sim(p, t);
          if s.g >= 1 or s.wet then continue; end if;
          update public.arena_farm_plots set progress = s.g, progress_at = t, wet = true
           where player_id = pid and idx = p.idx;
          v_plots = v_plots || to_jsonb(p.idx);
        end loop;
        gained = jsonb_build_object('perk', 'downpour', 'watered', v_plots);
      else
        update public.arena_farms set warm_until = t + interval '4 hours' where player_id = pid;
        gained = jsonb_build_object('perk', 'warmth', 'until', t + interval '4 hours');
      end if;
    end if;
  elsif a->>'a' = 'decor' then
    -- Place a decoration in one of the 8 spots (what stood there is replaced).
    plot = case when jsonb_typeof(a->'slot') = 'number' then (a->>'slot')::integer end;
    select * into v_item from public.arena_farm_decor_items where id = a->>'item';
    if plot is null or plot not between 0 and 7 then err = 'Choose a spot';
    elsif v_item.id is null then err = 'Unknown decoration';
    -- A free one (a reward) can be placed before its level.
    elsif f.level < v_item.level and not exists (select 1 from public.arena_farm_decor_credits
        where player_id = pid and item = v_item.id and qty > 0) then
      err = 'Unlocks at farm level ' || v_item.level;
    elsif exists (select 1 from public.arena_farm_decor where player_id = pid and slot = plot and item = v_item.id) then
      err = 'That is already there';
    else
      update public.arena_farm_decor_credits set qty = qty - 1
       where player_id = pid and item = v_item.id and qty > 0;
      get diagnostics inserted = row_count;
      cost = case when inserted > 0 then 0 else v_item.price end;
      if cost > 0 and not public.arena_spend_leaves(pid, cost, 'farm-decor', ref, d) then
        err = 'Not enough Gold Leaves';
      else
        insert into public.arena_farm_decor(player_id, slot, item, placed_at) values (pid, plot, v_item.id, t)
        on conflict (player_id, slot) do update set item = excluded.item, placed_at = excluded.placed_at;
        gained = jsonb_build_object('decor', v_item.id, 'slot', plot, 'cost', cost);
      end if;
    end if;
  elsif a->>'a' = 'decor-remove' then
    plot = case when jsonb_typeof(a->'slot') = 'number' then (a->>'slot')::integer end;
    if plot is null or plot not between 0 and 7 then err = 'Choose a spot';
    elsif not exists (select 1 from public.arena_farm_decor where player_id = pid and slot = plot and item is not null) then
      err = 'Nothing there';
    else
      update public.arena_farm_decor set item = null, placed_at = t where player_id = pid and slot = plot;
      gained = jsonb_build_object('removed', plot);
    end if;
  else
    -- 049: later actions (the pasture, Storm Milk) live in arena_farm_act_extra.
    select x.err, x.gained, x.xp into err, gained, xp
      from public.arena_farm_act_extra(pid, a, ref, t, d) x;
  end if;
end; $$;


revoke all on function public.arena_farm_act_more(uuid, jsonb, text, timestamptz, date)
  from public, anon, authenticated, service_role;
commit;
