-- Farm perks for the eight newest champions. Each farms with the perk of the
-- original champion of its element (its "twin"):
--   Coilemur  -> Voltkit's Zap          Pyranda   -> Cindrake's Warmth
--   Glacelle  -> Tidefin's Downpour     Halcyra   -> Auralynx's Shield
--   Sunbara   -> Lumoth's Early Sun     Astrabun  -> Mystowl's Foresight
--   Wombolder -> Terradon's Rich Soil   Shadopus  -> Duskveil's Night Stalker
-- arena_farm_perk_of() gives the champion whose perk a farmer has. The six
-- functions that check a perk are copied from their latest versions with only
-- that check changed (packages/shared/src/farm.ts FARM_PERK_OF is the same
-- map for the client). Run after 054.
begin;

create or replace function public.arena_farm_perk_of(p_farmer text) returns text
language sql immutable set search_path = '' as $$
  select case p_farmer
    when 'coilemur' then 'voltkit'
    when 'pyranda' then 'cindrake'
    when 'glacelle' then 'tidefin'
    when 'halcyra' then 'auralynx'
    when 'sunbara' then 'lumoth'
    when 'astrabun' then 'mystowl'
    when 'wombolder' then 'terradon'
    when 'shadopus' then 'duskveil'
    else p_farmer
  end
$$;

-- As in 046_farm_perks.sql, with the perk read through arena_farm_perk_of.
create or replace function public.arena_farm_sim(p public.arena_farm_plots, upto timestamptz,
  out g double precision, out wet boolean, out ripe_at timestamptz, out ripe_weather text)
language plpgsql stable set search_path = public as $$
declare at timestamptz; base double precision; s bigint; w text; seg_end timestamptz;
  rate double precision; need double precision; steps integer = 0;
begin
  if p.crop is null then g = 0; wet = false; return; end if;
  base = (case when p.fertilizer is not null then 1.4 else 1 end)
    * (1 - 0.2 * least(3, greatest(0, coalesce(p.pests, 0))))
    * (case when public.arena_farm_perk_of((select f.farmer from public.arena_farms f where f.player_id = p.player_id)) = 'lumoth'
        then 1.2 else 1 end)
    / (select grow_seconds from public.arena_farm_crops where id = p.crop)::double precision;
  g = p.progress; at = p.progress_at;
  wet = p.wet or exists (select 1 from generate_series(public.arena_farm_slot(p.planted_at),
    public.arena_farm_slot(p.progress_at)) x where public.arena_farm_weather(x) = 'rain');
  if g >= 1 then
    g = 1; ripe_at = p.progress_at; ripe_weather = public.arena_farm_weather(public.arena_farm_slot(at));
    return;
  end if;
  loop
    s = public.arena_farm_slot(at);
    w = public.arena_farm_weather(s);
    if w = 'rain' then wet = true; end if;
    seg_end = to_timestamp((s + 1) * 14400);
    rate = base * (case when wet then 1.35 else 1 end) * public.arena_farm_weather_speed(w);
    need = (1 - g) / rate;
    if at + make_interval(secs => need) <= least(seg_end, upto) then
      g = 1; ripe_at = at + make_interval(secs => need); ripe_weather = w;
      return;
    end if;
    if seg_end >= upto then
      g = least(1, g + rate * greatest(0, extract(epoch from (upto - at))));
      return;
    end if;
    g = g + rate * extract(epoch from (seg_end - at));
    at = seg_end;
    steps = steps + 1;
    if steps > 1000 then return; end if;
  end loop;
end; $$;

-- As in 047_farm_friends.sql, with the perk read through arena_farm_perk_of.
create or replace function public.arena_farm_yield(pid uuid, p_idx integer) returns integer
language sql stable security definer set search_path = public as $$
  select greatest(1, (case when public.arena_farm_perk_of((select farmer from public.arena_farms where player_id = pid)) = 'terradon'
    then 3 else 2 end) - coalesce((select stolen from public.arena_farm_plots where player_id = pid and idx = p_idx), 0))
$$;

-- As in 046_farm_perks.sql, with the perk read through arena_farm_perk_of.
create or replace function public.arena_farm_caught(pid uuid, p_idx integer) returns void
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; v_crop text;
begin
  select * into f from public.arena_farms where player_id = pid;
  if public.arena_farm_perk_of(f.farmer) is distinct from 'duskveil' then return; end if;
  select crop into v_crop from public.arena_farm_plots where player_id = pid and idx = p_idx;
  if v_crop is null or (select coalesce(sum(qty), 0) from public.arena_farm_barn where player_id = pid)
      >= 80 + 40 * f.barn_upgrades then
    return;
  end if;
  insert into public.arena_farm_barn(player_id, crop, mutation, qty) values (pid, v_crop, '', 1)
  on conflict (player_id, crop, mutation) do update set qty = public.arena_farm_barn.qty + 1;
end; $$;

-- As in 047_farm_friends.sql, with the perk read through arena_farm_perk_of.
create or replace function public.arena_farm_friend_act(p_request uuid, p_friend uuid, p_actions jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid = auth.uid(); t timestamptz = now(); d date = public.arena_today();
  a jsonb; i integer = 0; kind text; plot integer; p public.arena_farm_plots; s record;
  results jsonb = '[]'::jsonb; err text; gained jsonb; inserted integer; v_xp integer = 0;
  v_day public.arena_farm_friend_days; owner_f public.arena_farms; v_dog text; v_mut text;
  give integer; v_fine integer; v_catch double precision;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_request is null or jsonb_typeof(p_actions) is distinct from 'array'
     or jsonb_array_length(p_actions) not between 1 and 30 then
    raise exception 'Invalid farm request';
  end if;
  if p_friend is null or p_friend = me or not public.arena_farm_are_friends(me, p_friend) then
    raise exception 'Only friends can visit';
  end if;
  if not exists (select 1 from public.arena_farms where player_id = p_friend) then
    raise exception 'This friend has no farm yet';
  end if;
  perform public.arena_farm_ensure(me);
  -- Both farms, always locked in the same order.
  perform 1 from public.arena_farms where player_id in (me, p_friend) order by player_id for update;
  insert into public.arena_farm_requests(player_id, request) values (me, p_request) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('farm', public.arena_farm_view(me, p_friend), 'results', '[]'::jsonb, 'repeated', true);
  end if;
  perform public.arena_farm_dogs(p_friend);
  insert into public.arena_farm_friend_days(player_id, day) values (me, d) on conflict do nothing;
  select * into owner_f from public.arena_farms where player_id = p_friend;
  v_dog = public.arena_farm_dog(p_friend, t);
  for a in select * from jsonb_array_elements(p_actions) loop
    i = i + 1; err = null; gained = null;
    kind = a->>'a';
    plot = case when jsonb_typeof(a->'plot') = 'number' then (a->>'plot')::integer end;
    p = null;
    if plot between 0 and 49 then
      select * into p from public.arena_farm_plots where player_id = p_friend and idx = plot for update;
    end if;
    select * into v_day from public.arena_farm_friend_days x where x.player_id = me and x.day = d;
    if p.idx is null then err = 'Unknown plot';
    elsif kind = 'water' then
      select * into s from public.arena_farm_sim(p, t);
      if p.crop is null or s.g >= 1 then err = 'Nothing growing here';
      elsif s.wet then err = 'Already watered';
      else
        update public.arena_farm_plots set progress = s.g, progress_at = t, wet = true
         where player_id = p_friend and idx = plot;
        give = least(2, greatest(0, 60 - v_day.help_xp));
        update public.arena_farm_friend_days x set help_xp = x.help_xp + give where x.player_id = me and x.day = d;
        v_xp = v_xp + give;
        insert into public.arena_farm_visits(owner, visitor, kind, crop) values (p_friend, me, 'water', p.crop);
        gained = jsonb_build_object('xp', give);
      end if;
    elsif kind = 'catch' then
      if p.pests < 1 then err = 'No bugs here';
      else
        perform public.arena_farm_set_pests(p_friend, plot, p.pests - 1, t);
        give = least(3, greatest(0, 60 - v_day.help_xp));
        update public.arena_farm_friend_days x set help_xp = x.help_xp + give where x.player_id = me and x.day = d;
        v_xp = v_xp + give;
        insert into public.arena_farm_visits(owner, visitor, kind, crop) values (p_friend, me, 'catch', p.crop);
        gained = jsonb_build_object('xp', give);
      end if;
    elsif kind = 'sneak' then
      select * into s from public.arena_farm_sim(p, t);
      if p.crop is null or s.g < 1 then err = 'Nothing ripe here';
      elsif p.stolen >= 1 then err = 'Someone already snuck a crop from this plot';
      elsif exists (select 1 from public.arena_farm_sneaks k where k.thief = me and k.owner = p_friend
          and k.idx = plot and k.planted_at = p.planted_at) then err = 'You already tried this plot';
      elsif v_day.sneaks >= 10 then err = 'That''s enough sneaking for today';
      elsif (select coalesce(sum(qty), 0) from public.arena_farm_barn where player_id = me)
          >= 80 + 40 * (select barn_upgrades from public.arena_farms where player_id = me) then
        err = 'Your barn is full';
      else
        insert into public.arena_farm_sneaks(thief, owner, idx, planted_at) values (me, p_friend, plot, p.planted_at);
        update public.arena_farm_friend_days x set sneaks = x.sneaks + 1 where x.player_id = me and x.day = d;
        v_catch = coalesce((array[0.25, 0.8, 0.4])[array_position(array['gold', 'black', 'cream'], v_dog)], 0);
        if random() < v_catch then
          -- Caught: a 20 leaf fine to the owner, if you have it.
          v_fine = case when public.arena_spend_leaves(me, 20, 'farm-fine', p_request || ':' || i, d) then 20 else 0 end;
          if v_fine > 0 then
            perform public.arena_grant_leaves(p_friend, 20, 'farm-fine', me || ':' || p_request || ':' || i, d);
          end if;
          insert into public.arena_farm_visits(owner, visitor, kind, crop, n) values (p_friend, me, 'caught', p.crop, v_fine);
          gained = jsonb_build_object('caught', v_dog, 'fine', v_fine);
        else
          v_mut = coalesce(public.arena_farm_mutation(p_friend, p, s.ripe_weather), '');
          update public.arena_farm_plots set stolen = 1 where player_id = p_friend and idx = plot;
          insert into public.arena_farm_barn(player_id, crop, mutation, qty) values (me, p.crop, v_mut, 1)
          on conflict (player_id, crop, mutation) do update set qty = public.arena_farm_barn.qty + 1;
          insert into public.arena_farm_visits(owner, visitor, kind, crop) values (p_friend, me, 'sneak', p.crop);
          gained = jsonb_build_object('crop', p.crop, 'qty', 1, 'mutation', v_mut);
        end if;
      end if;
    elsif kind = 'prank' then
      select * into s from public.arena_farm_sim(p, t);
      if v_day.pranks >= 3 then err = 'No pranks left today';
      elsif public.arena_farm_perk_of(owner_f.farmer) = 'auralynx' then err = 'Their Shield blocks pranks';
      elsif p.crop is null or s.g >= 1 then err = 'Bugs only go on growing crops';
      elsif p.pests >= 3 then err = 'That plot can''t take more bugs';
      else
        perform public.arena_farm_set_pests(p_friend, plot, p.pests + 1, t);
        update public.arena_farm_friend_days x set pranks = x.pranks + 1 where x.player_id = me and x.day = d;
        insert into public.arena_farm_visits(owner, visitor, kind, crop) values (p_friend, me, 'prank', p.crop);
        gained = jsonb_build_object('pranksLeft', 2 - v_day.pranks);
      end if;
    else
      err = 'Unknown action';
    end if;
    results = results || jsonb_build_array(case when err is null
      then jsonb_build_object('ok', true) || coalesce(gained, '{}'::jsonb)
      else jsonb_build_object('ok', false, 'error', err) end);
  end loop;
  perform public.arena_farm_add_xp(me, v_xp);
  delete from public.arena_farm_visits where owner = p_friend and at < t - interval '30 days';
  return jsonb_build_object('farm', public.arena_farm_view(me, p_friend), 'results', results, 'xp', v_xp,
    'leaves', coalesce((select balance from public.arena_leaf_wallets where player_id = me), 0));
end; $$;
revoke all on function public.arena_farm_friend_act(uuid, uuid, jsonb) from public, anon;
grant execute on function public.arena_farm_friend_act(uuid, uuid, jsonb) to authenticated;

-- As in 049_farm_pasture.sql, with the perk read through arena_farm_perk_of.
create or replace function public.arena_farm_state(pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with c as (select public.arena_farm_state_core(pid) j, f.farmer, f.warm_until
    from public.arena_farms f where f.player_id = pid)
  select c.j || jsonb_build_object(
    'weather', case when public.arena_farm_perk_of(c.farmer) = 'mystowl' then c.j->'weather' else (c.j->'weather') - 'later' end,
    'farmer', c.farmer,
    'perksUsed', coalesce((select jsonb_agg(u.perk order by u.perk) from public.arena_farm_perk_uses u
      where u.player_id = pid and u.day = public.arena_today()), '[]'::jsonb),
    'warmUntil', case when c.warm_until > now() then c.warm_until end,
    'orders', coalesce((select jsonb_agg(jsonb_build_object('slot', o.slot, 'items', o.items,
        'leaves', o.leaves, 'xp', o.xp, 'bonus', o.bonus, 'who', o.who, 'face', o.face,
        'waitUntil', o.wait_until) order by o.slot)
      from public.arena_farm_orders o where o.player_id = pid), '[]'::jsonb),
    'bookRewards', coalesce((select jsonb_agg(b.found order by b.found)
      from public.arena_farm_book_rewards b where b.player_id = pid), '[]'::jsonb),
    'wishReady', not exists (select 1 from public.arena_farm_wishes w
      where w.player_id = pid and w.day = public.arena_today()),
    'mastery', coalesce((select jsonb_object_agg(m.crop, m.stars) from public.arena_farm_mastery m
      where m.player_id = pid and m.stars > 0), '{}'::jsonb),
    'dog', (select jsonb_build_object('type', h.dog, 'since', h.started_at, 'until', h.ends_at)
      from public.arena_farm_dog_hires h
      where h.player_id = pid and h.started_at <= now() and h.ends_at > now()
      order by h.ends_at desc limit 1),
    'dogGifts', coalesce((select jsonb_agg(jsonb_build_object('at', g.dug_at, 'dog', g.dog,
        'kind', g.kind, 'crop', g.crop, 'qty', g.qty) order by g.dug_at desc)
      from (select * from public.arena_farm_dog_gifts g where g.player_id = pid
        order by g.dug_at desc limit 10) g), '[]'::jsonb),
    'crows', coalesce((select jsonb_object_agg(x.idx::text, x.crow_at) from public.arena_farm_plots x
      where x.player_id = pid and x.crow_at is not null), '{}'::jsonb),
    'visits', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'at', v.at, 'name', pr.display_name,
        'kind', v.kind, 'crop', v.crop, 'n', v.n) order by v.at desc, v.id desc)
      from (select * from public.arena_farm_visits v where v.owner = pid and v.at > now() - interval '3 days'
        order by v.at desc, v.id desc limit 20) v join public.arena_profiles pr on pr.id = v.visitor), '[]'::jsonb),
    'decor', coalesce((select jsonb_agg(jsonb_build_object('slot', x.slot, 'item', x.item) order by x.slot)
      from public.arena_farm_decor x where x.player_id = pid and x.item is not null), '[]'::jsonb),
    'charm', public.arena_farm_charm(pid),
    'decorCredits', coalesce((select jsonb_object_agg(x.item, x.qty) from public.arena_farm_decor_credits x
      where x.player_id = pid and x.qty > 0), '{}'::jsonb))
    -- 049: later fields (the pasture, Storm Milk) come from arena_farm_state_extra.
    || public.arena_farm_state_extra(pid)
  from c
$$;

-- As in 052_sixteen_champions.sql, with the perk read through arena_farm_perk_of.
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
