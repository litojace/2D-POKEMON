-- Faster crops, in the spirit of popular farm games: starter crops ripen in
-- a few minutes so a short visit always ends in a harvest; later crops take
-- hours, and the legendary ones grow overnight (at most 12 hours).
-- Run after 061_farm_party.sql. Safe to run again.
-- Plantings already in the ground speed up too: growth is the time since
-- planting over the crop's grow time, so a crop past its new time is ripe.
begin;

update public.arena_farm_crops c set grow_seconds = v.secs
from (values
  ('wheat', 120), ('carrot', 300), ('voltberry', 600), ('mint', 900), ('pepper', 1200),
  ('lotus', 1800), ('lumen', 2700), ('duskcap', 3600), ('plum', 4500), ('grape', 5400),
  ('pumpkin', 7200), ('kelp', 7200), ('cactus', 9000), ('yam', 10800), ('poppy', 12600),
  ('halotea', 14400), ('melon', 16200), ('pearl', 18000), ('orange', 19800), ('cotton', 21600),
  ('ginseng', 25200), ('boltcorn', 28800), ('starfruit', 32400), ('emberlily', 36000),
  ('dreamshroom', 43200)
) as v(id, secs)
where c.id = v.id and c.grow_seconds is distinct from v.secs;

commit;
