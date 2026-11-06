-- Decoration storage, as in most farm games: a decoration you put away, or
-- one you replace by placing another on its spot, goes to storage (a free
-- copy, the same kind the crop book's statue reward uses) and places again
-- at no cost. Before this, both were lost (048 copied the prototype).
-- Run after 064_farm_faster_milk.sql. Safe to run again.
begin;

-- As in 055_new_champion_farm_perks.sql, with removed and replaced
-- decorations stored.
create or replace function public.arena_farm_act_more(pid uuid, a jsonb, ref text, t timestamptz, d date,
  out err text, out gained jsonb, out xp integer)
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; v_dog text; v_days integer; cost integer; v_level integer; v_old text;
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
    v_perk = case public.arena_farm_perk_of(f.farmer) when 'voltkit' then 'zap' when 'tidefin' then 'downpour' when 'cindrake' then 'warmth' end;
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
    -- A free one (stored, or a reward) can be placed before its level.
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
        -- What stood there goes to storage.
        select x.item into v_old from public.arena_farm_decor x
         where x.player_id = pid and x.slot = plot and x.item is not null;
        if v_old is not null then
          insert into public.arena_farm_decor_credits(player_id, item, qty) values (pid, v_old, 1)
          on conflict (player_id, item) do update set qty = public.arena_farm_decor_credits.qty + 1;
        end if;
        insert into public.arena_farm_decor(player_id, slot, item, placed_at) values (pid, plot, v_item.id, t)
        on conflict (player_id, slot) do update set item = excluded.item, placed_at = excluded.placed_at;
        gained = jsonb_build_object('decor', v_item.id, 'slot', plot, 'cost', cost)
          || case when v_old is not null then jsonb_build_object('stored', v_old) else '{}'::jsonb end;
      end if;
    end if;
  elsif a->>'a' = 'decor-remove' then
    plot = case when jsonb_typeof(a->'slot') = 'number' then (a->>'slot')::integer end;
    if plot is null or plot not between 0 and 7 then err = 'Choose a spot';
    elsif not exists (select 1 from public.arena_farm_decor where player_id = pid and slot = plot and item is not null) then
      err = 'Nothing there';
    else
      -- Into storage: it places again for free.
      select x.item into v_old from public.arena_farm_decor x where x.player_id = pid and x.slot = plot;
      insert into public.arena_farm_decor_credits(player_id, item, qty) values (pid, v_old, 1)
      on conflict (player_id, item) do update set qty = public.arena_farm_decor_credits.qty + 1;
      update public.arena_farm_decor set item = null, placed_at = t where player_id = pid and slot = plot;
      gained = jsonb_build_object('removed', plot, 'stored', v_old);
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
