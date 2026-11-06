# Eight new champions (design handoff)

Eight original champions designed and balanced in simulation, not yet in the
game. This folder holds everything a fresh session needs to implement them.
Each kit borrows a proven mechanic idea from another game (credited in
`NEW_INSPIRATION`), with original names, looks and numbers.

| Champion  | Element  | Role             | Creature          | Signature mechanic                               |
| --------- | -------- | ---------------- | ----------------- | ------------------------------------------------ |
| Coilemur  | Electric | Grappler         | Ring-tailed lemur | Magnet Lash pulls the first enemy hit to it      |
| Pyranda   | Fire     | Artillery        | Red panda         | Lobbed chestnut mortars, Toasted combo           |
| Glacelle  | Water    | Frost controller | Sea angel         | Slows, then freezes: the only true Freeze        |
| Halcyra   | Aura     | Marksman         | Kingfisher        | Up to 50% more damage at long range (`farBonus`) |
| Sunbara   | Light    | Support          | Capybara          | Healing springs: full to allies, half to itself  |
| Astrabun  | Psychic  | Blink duelist    | Moon rabbit       | Moon Hop blink, Moonlit self combo               |
| Wombolder | Earth    | Charger          | Wombat            | Burrow Rush charge, extra damage into walls      |
| Shadopus  | Shadow   | Stealth assassin | Octopus           | Ink Cloud stealth, first hit out of it +40%      |

## Files

- `prototype/new-champions.ts`: kits (`NEW_CHARACTERS`), combos, rites and the
  game inspirations, in the same shape as `CHARACTERS` / `COMBOS` / `RITES`
  in `packages/shared/src/index.ts`. Health and basic intervals here are the
  demo values; apply `tuned-factors.json` (below) when implementing.
- `prototype/art.js`: front-view art for all eight in the idiom of
  `apps/client/src/creature-design.ts` (200×190 canvas, palettes, layers).
  Side and back views, the rig and portraits still need to be made.
- `prototype/tuned-factors.json`: auto-tune factors from the sixteen-champion
  balance pass (health × f, basic interval ÷ √f, rounded to 5 ms):

| Champion  | Health    | Basic attack (ms) |
| --------- | --------- | ----------------- |
| Coilemur  | 135 → 140 | 370 → 365         |
| Pyranda   | 145 → 149 | 430 → 425         |
| Glacelle  | 149 → 153 | 330 → 325         |
| Halcyra   | 145 → 143 | 365               |
| Sunbara   | 189 → 188 | 335               |
| Astrabun  | 132 → 133 | 415               |
| Wombolder | 166 → 172 | 545 → 535         |
| Shadopus  | 129 → 127 | 305               |

These were tuned in a sixteen-champion pool with the original eight's
creature remodel and the attack speed fix (see
[creature-remodel.md](../creature-remodel.md)), where all sixteen averaged
48–52% (bot round robin, 40 games per pairing per difficulty). The original
eight were then re-tuned on their own for release, so when these ship, re-run
the auto-tune with all sixteen together (below).

## Balance tools

`scripts/balance/` runs bot round robins on the real server `Arena` (run from
the repository root):

```sh
# Win rates for the champions in FIGHTER_IDS, factors left alone
npx tsx scripts/balance/tune.ts 1 40
# Auto-tune: 6 rounds, factors averaged over the last 3
npx tsx scripts/balance/tune.ts 6 40
```

A factor f scales health by f and divides the basic interval by √f (rounded
to 5 ms); skills are not touched. Each round writes `balance-out/round-N.json`
(gitignored) with the factors, Hard and Normal win rates and the next
factors, and the run ends with the health and interval the averaged factors
give. With 4 processes, 16 champions at 40 games take about 8 minutes per
round. Use 40 games or more: in a 4-game test, win rates moved 10 to 25
points between rounds while no factor changed by more than 5%.

## Shipped balance (sixteen champions)

When the eight shipped, the auto-tune ran with all sixteen together (six
rounds of 40 games per pairing per difficulty, factors averaged over the last
three) and its factors went to every champion, old and new. Win rates are the
average of Hard and Normal bots, sixteen champions, 1,200 matches each (before:
the original eight as on main plus the new eight at the values above; after:
the tuned numbers, a fresh round robin). Wombolder's Rump Bump knockback went
from 30 to 25 first, to keep melee basics within the game's limit.

| Champion  | Factor | Health    | Basic attack (ms) | Win rate before | After |
| --------- | ------ | --------- | ----------------- | --------------- | ----- |
| Voltkit   | ×1.020 | 153 → 156 | 275 → 270         | 46.3%           | 50.5% |
| Cindrake  | ×0.971 | 141 → 137 | 475 → 480         | 55.4%           | 51.4% |
| Tidefin   | ×1.029 | 146 → 150 | 245 → 240         | 44.9%           | 51.4% |
| Auralynx  | ×0.953 | 177 → 169 | 320 → 330         | 59.8%           | 50.2% |
| Lumoth    | ×1.001 | 140       | 305               | 49.9%           | 50.4% |
| Mystowl   | ×1.000 | 142       | 380               | 49.4%           | 49.8% |
| Terradon  | ×0.964 | 199 → 192 | 625 → 635         | 57.5%           | 49.0% |
| Duskveil  | ×1.043 | 139 → 145 | 365 → 355         | 42.5%           | 50.2% |
| Coilemur  | ×0.992 | 140 → 139 | 365               | 51.1%           | 52.4% |
| Pyranda   | ×1.004 | 149 → 150 | 425               | 49.1%           | 49.0% |
| Glacelle  | ×1.001 | 153       | 325               | 50.2%           | 51.1% |
| Halcyra   | ×0.998 | 143       | 365               | 50.6%           | 49.5% |
| Sunbara   | ×1.012 | 188 → 190 | 335               | 46.9%           | 47.1% |
| Astrabun  | ×0.996 | 133 → 132 | 415               | 51.5%           | 50.1% |
| Wombolder | ×1.005 | 172 → 173 | 535               | 48.0%           | 50.4% |
| Shadopus  | ×1.005 | 127 → 128 | 305               | 46.9%           | 47.2% |

All sixteen now win 47–52% in duels (before: 42–60%).

### Duels re-tuned for the fixed bots

After the bot fix below ([Bots: Hard and Normal](#bots-hard-and-normal)),
Normal bots stopped flipping champions' win rates, and the duel numbers had
to be tuned again: the old ~50% averages had come from Hard and Normal
flipping in opposite directions. Two passes with `scripts/balance/tune.ts`
(eight rounds of 20 games per pairing per difficulty, then, after
re-calibrating `dazeBy` for the new numbers, one more 40-game step), written
into the champions' numbers with `scripts/balance/apply-factors.ts`. Win
rates: Hard and Normal averaged, 1,200 duels per champion on seeds the tuner
never saw (`RR_SEED=60000`); before is `main` with the fixed bots.

| Champion  | Health    | Basic attack (ms) | Before | After | Hard / Normal after |
| --------- | --------- | ----------------- | ------ | ----- | ------------------- |
| Voltkit   | 156 → 153 | 270               | 49.1%  | 49.9% | 46.2% / 53.5%       |
| Cindrake  | 137 → 151 | 480 → 455         | 27.8%  | 51.0% | 54.2% / 47.7%       |
| Tidefin   | 150 → 146 | 240               | 53.4%  | 53.1% | 52.3% / 54%         |
| Auralynx  | 169 → 164 | 330 → 335         | 57.3%  | 46.6% | 50% / 43.3%         |
| Lumoth    | 140 → 139 | 305 → 310         | 52.6%  | 48.3% | 48.3% / 48.2%       |
| Mystowl   | 142 → 134 | 380 → 390         | 66.3%  | 51.9% | 53.2% / 50.5%       |
| Terradon  | 192 → 193 | 635 → 630         | 39.4%  | 50.8% | 48.7% / 52.8%       |
| Duskveil  | 145 → 152 | 355 → 345         | 40.0%  | 51.1% | 48.2% / 54%         |
| Coilemur  | 139 → 144 | 365 → 360         | 44.5%  | 50.0% | 51.2% / 48.7%       |
| Pyranda   | 150 → 140 | 425 → 440         | 61.0%  | 49.6% | 45.8% / 53.5%       |
| Glacelle  | 153 → 152 | 325               | 48.6%  | 48.8% | 48.5% / 49%         |
| Halcyra   | 143 → 138 | 365 → 370         | 60.3%  | 50.5% | 54.2% / 46.8%       |
| Sunbara   | 190       | 335               | 55.9%  | 52.8% | 54.8% / 50.7%       |
| Astrabun  | 132 → 134 | 415 → 410         | 45.9%  | 50.4% | 48.7% / 52%         |
| Wombolder | 173       | 535               | 48.7%  | 46.5% | 45.5% / 47.5%       |
| Shadopus  | 128 → 129 | 305               | 49.3%  | 49.0% | 50.3% / 47.8%       |

All sixteen now win 46.5–53.1% (before: 27.8–66.3%; standard error about
1.4 points). Every champion's Hard–Normal gap is under 8 points (largest
7.7, Pyranda; average 4.1). Normal still takes 3.0% of rounds from Hard and
Easy 31.3% from Normal.

### 2v2

2v2 has its own per-champion tuning (`TEAM_TUNING` in
`packages/shared/src/index.ts`, team mode only): health × f and basic-attack
interval ÷ √f, the same form as the duel tuning. Duels and raids keep the
champions' own numbers; free-for-all has its own table (below).

Why: with the duel numbers, champions with a melee basic won 55–63% of 2v2
matches and ranged ones 36–49% (this was older than the new eight). Measured
in bot matches, ranged champions play 2v2 as well as duels (enemies in range
about 95% of the time, the same ~30% basic accuracy, 86–103% of their duel
damage per second), but melee champions deal 7–31% more damage per second
than in a duel: with two enemies on the field one is nearly always in reach.
Cleave (one swing hitting both enemies) is only 4–10% of their damage, so
cutting it alone would not have closed the gap.

Tuned with `npx tsx scripts/balance/tune-teams.ts` (six rounds of 2,000
random-team matches per difficulty on fixed line-ups, then three rounds on
fresh line-ups each round, factors averaged over the last three). Checked on
3,000 matches per difficulty of line-ups the tuner never saw (Hard and
Normal averaged):

| Champion  | 2v2 factor | Before | After |
| --------- | ---------- | ------ | ----- |
| Astrabun  | ×0.855     | 63.0%  | 50.3% |
| Auralynx  | ×0.883     | 61.2%  | 49.1% |
| Terradon  | ×0.882     | 59.5%  | 48.8% |
| Coilemur  | ×0.902     | 59.3%  | 50.8% |
| Cindrake  | ×0.910     | 58.8%  | 49.5% |
| Wombolder | ×0.944     | 55.5%  | 51.1% |
| Shadopus  | ×0.921     | 55.0%  | 51.0% |
| Pyranda   | ×1.000     | 51.2%  | 52.0% |
| Glacelle  | ×1.017     | 48.4%  | 49.9% |
| Tidefin   | ×1.028     | 43.5%  | 47.5% |
| Sunbara   | ×1.048     | 43.5%  | 49.3% |
| Mystowl   | ×1.142     | 42.8%  | 54.8% |
| Duskveil  | ×1.092     | 42.8%  | 51.0% |
| Halcyra   | ×1.126     | 41.3%  | 50.2% |
| Lumoth    | ×1.127     | 38.2%  | 48.1% |
| Voltkit   | ×1.134     | 35.8%  | 46.8% |

Spread 35.8–63.0% (standard deviation 8.7) before, 46.8–54.8% (1.9) after.
Round-to-round noise on fresh line-ups is about ±4 points per champion, so
the remaining differences are mostly noise. Mystowl's 54.8% is its known
Hard/Normal split (64% / 46%), not a 2v2 effect.

#### Re-tuned for the fixed bots

The numbers above were measured with the old bots, which all fought the
first opponent to join and whose Normal difficulty flipped champions' win
rates. With the fixed bots and the re-tuned duel numbers (see "Bots: Hard
and Normal" and "Duels re-tuned for the fixed bots"), the old factors gave
ranged champions 50–65% and melee ones 31–43%, the opposite of the old
problem, so the factors were tuned again from 1 (six rounds of 1,200
matches per difficulty on fixed line-ups, then four on fresh line-ups each
round, factors averaged over the last three). Checked on 2,000 matches per
difficulty of line-ups the tuner never saw (`TEAMS_SEED=31337`, Hard and
Normal averaged):

| Champion  | 2v2 factor          | Before | After |
| --------- | ------------------- | ------ | ----- |
| Mystowl   | ×1.006 (was ×1.142) | 64.5%  | 51.0% |
| Halcyra   | ×1.008 (was ×1.126) | 63.1%  | 49.1% |
| Lumoth    | ×0.997 (was ×1.127) | 63.1%  | 49.9% |
| Pyranda   | ×0.915 (was ×1.000) | 61.5%  | 49.4% |
| Sunbara   | ×0.966 (was ×1.048) | 60.5%  | 49.6% |
| Voltkit   | ×1.045 (was ×1.134) | 59.0%  | 49.9% |
| Duskveil  | ×1.025 (was ×1.092) | 58.0%  | 47.9% |
| Glacelle  | ×0.963 (was ×1.017) | 54.3%  | 48.1% |
| Tidefin   | ×1.000 (was ×1.028) | 49.8%  | 47.9% |
| Wombolder | ×1.006 (was ×0.944) | 42.6%  | 49.8% |
| Coilemur  | ×1.006 (was ×0.902) | 42.2%  | 52.9% |
| Terradon  | ×0.993 (was ×0.882) | 41.9%  | 54.5% |
| Auralynx  | ×0.970 (was ×0.883) | 39.9%  | 49.1% |
| Cindrake  | ×0.993 (was ×0.910) | 36.8%  | 49.3% |
| Shadopus  | ×1.047 (was ×0.921) | 33.7%  | 49.6% |
| Astrabun  | ×1.008 (was ×0.855) | 30.9%  | 50.9% |

Spread 30.9–64.5% (standard deviation 11.3) before, 47.9–54.5% (1.7) after.
Every factor is now within 10% of 1: with the fixed bots 2v2 needs little
tuning of its own. The melee/ranged explanation above describes the old
bots.

### Free-for-all

Free-for-all has its own per-champion tuning too (`FFA_TUNING` in
`packages/shared/src/index.ts`, free-for-all only), in the same form: health
× f and basic-attack interval ÷ √f. A free-for-all that started with three
players has its own table, `FFA_THREE_TUNING` (it used to apply 60% of each
four-player factor, `FFA_THREE_SCALE`; see "Re-tuned for the fixed bots"
below).

Why: with the duel numbers, ranged champions won 32–40% of four-player
free-for-alls and melee ones 5–22%, against a fair 25% (three players: 36–45%
and 12–33%, against a fair 33%). Measured in bot matches
(`scripts/balance/measure-ffa.ts`), each champion deals 94–120% and takes
92–126% of its duel damage per second while alive, with no split between
melee and ranged, and spends a similar share of its time with an enemy in
basic-attack reach (ranged ~100%, melee 33–49%; duels: ~96% and 24–41%). What
changes is what wins: a free-for-all goes to the last fighter standing. Melee
champions take about twice the damage per second of ranged ones (12–13
against 5.7–7.4), so a full-health melee champion lasts 10–16 seconds of
fighting against 23–26 for a ranged one. In a duel their higher damage (8–15
a second against 4.8–7.7) makes up for it. The likely reason it does not in a
free-for-all (a reading of these numbers, not measured on its own): there,
killing one enemy does not stop the others hitting you, so lasting matters
more than damage.

Tuned with `npx tsx scripts/balance/tune-teams.ts --mode ffa` (six rounds of
600 four-player matches per difficulty on fixed line-ups at gain 2, then six
rounds of 800 on fresh line-ups each round at gain 1, factors averaged over
the last three). Checked on 3,200 four-player matches per difficulty of
line-ups the tuner never saw (`FFA_SEED=9090`, Hard and Normal averaged,
standard error ±1.1 points per champion):

| Champion  | FFA factor | Before | After |
| --------- | ---------- | ------ | ----- |
| Halcyra   | ×0.769     | 40.1%  | 27.8% |
| Duskveil  | ×0.757     | 39.7%  | 25.4% |
| Pyranda   | ×0.769     | 38.1%  | 25.0% |
| Mystowl   | ×0.821     | 36.7%  | 26.7% |
| Lumoth    | ×0.786     | 35.9%  | 24.3% |
| Sunbara   | ×0.836     | 35.3%  | 24.5% |
| Glacelle  | ×0.829     | 32.7%  | 24.3% |
| Voltkit   | ×0.792     | 32.2%  | 24.2% |
| Tidefin   | ×0.833     | 31.9%  | 23.7% |
| Terradon  | ×0.989     | 22.3%  | 25.8% |
| Auralynx  | ×1.076     | 14.4%  | 23.2% |
| Wombolder | ×1.143     | 11.9%  | 27.4% |
| Cindrake  | ×1.205     | 10.7%  | 24.4% |
| Coilemur  | ×1.284     | 6.4%   | 25.4% |
| Shadopus  | ×1.246     | 6.2%   | 23.4% |
| Astrabun  | ×1.314     | 5.6%   | 24.6% |

Spread 5.6–40.1% (standard deviation 13.0) before, 23.2–27.8% (1.3) after;
the remaining spread is about the size of the noise. A second fresh set
(`FFA_SEED=31337`, 1,200 matches per difficulty) gives 19.3–28.5%; pooled
over both sets every champion is at 22.2–27.6%.

Three players: the four-player factors at full strength overshoot (melee
35–47%, ranged 24–31% against a fair 33%), because with one enemy fewer the
melee/ranged gap is about 60% of the four-player one (the same 0.59–0.62 for
melee and ranged champions). With `FFA_THREE_SCALE` = 0.6, pooled over two
fresh sets of 1,200 matches per difficulty, every champion wins 27.0–36.9%
(±1.6), against 12–45% before. Shadopus (27.0%) is the one clear outlier.

#### Re-tuned for the fixed bots

Everything above was measured with the old bots, which all fought the first
opponent to join, so in a bot free-for-all seat 0 never won and the last
seat won 61–78%. With the fixed bots and the re-tuned duel numbers, the old
factors gave 10–53% with four players (against a fair 25%) and 25–41% with
three (fair 33%). Measured again with the fixed bots, at factor 1 for
everyone melee champions still win far less than ranged ones (four players:
8–22% against 25–43%), so free-for-all keeps a table of its own; three
players need a stronger correction than four, not 60% of it, and one scale
could not fix champions one by one, so three players now have their own
table (`FFA_THREE_TUNING`).

Tuned with `npx tsx scripts/balance/tune-teams.ts --mode ffa` (four players:
five rounds of 800 matches per difficulty on fixed line-ups, then six rounds of
1,000 on fresh line-ups each round in two series, `FRESH_BASE` 6000 and
6100; three players, `--players 3`: three fresh rounds of 1,200, starting
from the four-player factors with their distance from 1 scaled by 1.4). Checked on line-ups no tuning round used
(`FFA_SEED=31337`; four players 2,000 matches per difficulty, three players
1,200; before is `main` with the fixed bots, 1,200 and 800):

| Champion  | 4-player factor (was) | 4p before | 4p after | 3-player factor | 3p before | 3p after |
| --------- | --------------------- | --------- | -------- | --------------- | --------- | -------- |
| Astrabun  | ×1.008 (×1.008)       | 53.4%     | 21.8%    | ×1.106          | 36.8%     | 34.2%    |
| Shadopus  | ×1.047 (×1.047)       | 40.9%     | 25.1%    | ×1.144          | 33.5%     | 31.6%    |
| Coilemur  | ×1.006 (×1.006)       | 38.7%     | 25.9%    | ×1.242          | 31.5%     | 33.3%    |
| Cindrake  | ×0.993 (×0.993)       | 36.2%     | 24.7%    | ×1.189          | 29.3%     | 35.7%    |
| Wombolder | ×1.006 (×1.006)       | 32.8%     | 27.3%    | ×1.161          | 27.1%     | 31.5%    |
| Auralynx  | ×0.970 (×0.970)       | 25.5%     | 25.6%    | ×1.127          | 25.1%     | 29.8%    |
| Tidefin   | ×1.000 (×1.000)       | 24.9%     | 24.9%    | ×0.835          | 39.7%     | 33.4%    |
| Terradon  | ×0.993 (×0.993)       | 24.2%     | 24.7%    | ×1.056          | 27.2%     | 32.8%    |
| Mystowl   | ×1.006 (×1.006)       | 22.8%     | 21.9%    | ×0.838          | 35.0%     | 33.6%    |
| Sunbara   | ×0.966 (×0.966)       | 22.5%     | 27.2%    | ×0.860          | 40.7%     | 33.5%    |
| Pyranda   | ×0.915 (×0.915)       | 15.0%     | 24.8%    | ×0.852          | 39.8%     | 38.0%    |
| Voltkit   | ×1.045 (×1.045)       | 14.8%     | 22.8%    | ×0.868          | 33.4%     | 31.8%    |
| Glacelle  | ×0.963 (×0.963)       | 14.1%     | 24.0%    | ×0.936          | 32.3%     | 36.3%    |
| Halcyra   | ×1.008 (×1.008)       | 12.4%     | 23.5%    | ×0.788          | 32.0%     | 31.5%    |
| Duskveil  | ×1.025 (×1.025)       | 11.9%     | 29.9%    | ×0.864          | 31.9%     | 31.2%    |
| Lumoth    | ×0.997 (×0.997)       | 10.5%     | 26.1%    | ×0.864          | 38.5%     | 34.2%    |

Four players: 10.5–53.4% (standard deviation 12.0) before, 21.8–29.9% (2.0)
after, standard error ±1.4 points per champion; all but Duskveil (29.9%) are
within 3 points of 25%. Three players: 25.1–40.7% (4.7) before, 29.8–38.0%
(2.0) after, ±2.2 points; Pyranda (38.0%) is the largest outlier. Each seat
wins about the same now (23–26% with four players).

### Bots: Hard and Normal

Bots used to play some champions very differently at Hard and Normal, so a
champion's bot win rate flipped with difficulty: Cindrake won 27% of duels
between Hard bots and 74% between Normal bots, Mystowl 67% / 33%, Pyranda
63% / 39%, Duskveil 40% / 62%, Halcyra 58% / 42%. Measured
(`scripts/balance/duel-diag.ts`, and round robins with one profile setting
changed at a time through `BOT_OVERRIDE`), not guessed:

- Every weakness a bot can have helps melee champions more than ranged ones.
  A Normal opponent reacts late (0.48 s), pauses its basic attack a third of
  the time, aims loosely and decides slowly; each of these mostly costs a
  ranged champion hits and lets a brawler walk in. With Normal opponents
  given Hard's reaction alone, Normal Cindrake drops from 73% to 29%; with
  Hard's `rest` alone, to 39%. Played by a Normal bot against Hard
  opponents, Cindrake wins 0%: Hard plays it well, Normal opponents just
  played badly against it.
- A bot only noticed a shot coming if it had decided to dodge it, and its
  barriers and counters wait for a threat. Normal bots dodge 12% of shots,
  so they almost never shielded: Mystowl's Wing Cloak 1.7 casts a minute at
  Normal against 4.8 at Hard, Pyranda's Tail Wrap 1.9 / 4.6, Halcyra's
  Mirage Perch 1.0 / 3.8.

No single weakness affects every champion alike (a uniform "dazed" share of
seconds favours brawlers too), so the fix (`apps/server/src/bot.ts`):

- `seeShots` (Hard and Normal): any shot about to hit counts as a threat for
  defensive skills, whether or not the bot dodges it.
- Normal is closer to Hard on the settings that favoured brawlers (reaction
  0.36 s, aim error 0.215, decisions every 0.19 s, dodge 43%, rest 12%) and
  is held back instead by a per-champion share of dazed seconds (`dazeBy`,
  15–41%: no moving, attacking or skills for that second), calibrated in
  bot duels so each champion does as well against Normal as against Hard.
  Hard has no daze.

Checked on 600 duels per champion and difficulty the calibration never saw
(`RR_SEED=60000`):

| Champion  | Hard before | Normal before | Gap   | Hard after | Normal after | Gap  |
| --------- | ----------- | ------------- | ----- | ---------- | ------------ | ---- |
| Cindrake  | 27.2%       | 73.5%         | −46.3 | 27.0%      | 28.5%        | −1.5 |
| Mystowl   | 66.5%       | 32.7%         | +33.8 | 66.5%      | 66.2%        | +0.3 |
| Pyranda   | 62.7%       | 39.0%         | +23.7 | 61.2%      | 60.8%        | +0.4 |
| Duskveil  | 39.5%       | 62.3%         | −22.8 | 39.7%      | 40.3%        | −0.6 |
| Halcyra   | 58.2%       | 41.5%         | +16.7 | 58.7%      | 61.8%        | −3.1 |
| Sunbara   | 57.8%       | 46.0%         | +11.8 | 55.3%      | 56.5%        | −1.2 |
| Wombolder | 43.8%       | 54.7%         | −10.9 | 46.7%      | 50.7%        | −4.0 |
| Terradon  | 40.8%       | 51.5%         | −10.7 | 42.8%      | 36.0%        | +6.8 |
| Astrabun  | 46.0%       | 53.7%         | −7.7  | 46.0%      | 45.7%        | +0.3 |
| Lumoth    | 51.5%       | 44.7%         | +6.8  | 52.0%      | 53.2%        | −1.2 |
| Voltkit   | 52.0%       | 47.0%         | +5.0  | 49.0%      | 49.3%        | −0.3 |
| Auralynx  | 54.7%       | 50.7%         | +4.0  | 58.5%      | 56.0%        | +2.5 |
| Coilemur  | 46.5%       | 50.5%         | −4.0  | 47.3%      | 41.8%        | +5.5 |
| Shadopus  | 50.3%       | 54.2%         | −3.9  | 50.0%      | 48.5%        | +1.5 |
| Tidefin   | 50.5%       | 48.3%         | +2.2  | 52.5%      | 54.2%        | −1.7 |
| Glacelle  | 52.0%       | 49.8%         | +2.2  | 46.8%      | 50.5%        | −3.7 |

Average gap 13.3 points before, 2.2 after; the largest is now 6.8
(Terradon). Overall difficulty is about where it was (Hard against Normal
and Normal against Easy, `scripts/balance/difficulty-gap.ts`, 960 duels
each): Normal takes 3.4% of rounds from Hard (2.0% before) and Easy takes
31.3% of rounds from Normal (27.3% before).

Separately, with several opponents (2v2, free-for-all) every bot used to
fight the first opponent to join, so in bot free-for-alls seat 0 won 0% and
the last seat 61–78%. Bots now weigh opponents by distance, health and line
of sight and stay on their target; each seat now wins 24–26%. Duels and raid
bosses (one opponent) are unaffected.

## Known issues

- Bot free-for-alls (re-tuned above): Duskveil wins 29.9% of four-player
  matches (fair 25%, ±1.5) and Pyranda 38.0% of three-player ones (fair 33%,
  ±2.2). On another set of line-ups Duskveil was at 25.8%, so this is likely
  noise; re-measure with `npx tsx scripts/balance/measure-ffa.ts`.
- Raids use the champions' own health, which the duel re-tune changed
  slightly; raids were not re-measured.

## Engine

The six mechanics are real (`packages/shared/src/index.ts`,
`apps/server/src/simulation.ts`, `apps/server/src/bot.ts`; tests in
`tests/unit/new-mechanics.test.ts`):

| Mechanic      | Fields                  | How it works                                                                                                                                                                                                                                                                                                                    |
| ------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pull          | `knockback < 0`         | Drags the target toward the caster, stopping 6 px short of touching (never past). Works on hits and zone ticks (Electromagnet).                                                                                                                                                                                                 |
| Blink         | kind `blink`            | Teleports toward the aim, up to `range`, stopping before the first wall (`blinkLanding`). With `damage`, a burst of `radius` where it lands. A `burst` event marks the landing (`tx`, `ty`: where it left).                                                                                                                     |
| Rush          | kind `rush`, `wallSlam` | A dash of `range` at `speed`; the caster can't act meanwhile. The first enemy touched takes the hit (and everyone within `explosion` of it); the charge stops. If the knockback would drive the target into a wall: `wallSlam` × damage and twice the stun (`burst` event with `slam`). A stun, freeze or dash ends the charge. |
| Veil, ambush  | kind `veil`, `ambush`   | Stealth for `duration` plus haste for `statusDuration`. Casting or taking damage reveals; the first hit within 0.8 s of a cast out of stealth deals `ambush` × damage (`hit` event with `ambush`).                                                                                                                              |
| Healing zones | zone `heal`, `selfHeal` | Each tick heals the caster's team inside by `heal`, the caster by `selfHeal` × `heal` (`heal` events). A pure spring does nothing to enemies; one with a `status` still applies it.                                                                                                                                             |
| Far bonus     | `farBonus`              | Up to `farBonus` more damage the farther the target is (`farMultiplier`): none up close, all of it at the ability's `range`.                                                                                                                                                                                                    |

Bots score each kind with its own rule in `chooseSkill`, ported from the
prototype's scoring: rushes and blinks once the target is within 90% of their
reach, the veil when the target is in sight within 520 px, a following spring
in the thick of a fight and a still one when hurt and under pressure, and
marksman shots by their far bonus. Bots no longer step out of a teammate's
zone or a harmless enemy spring. `riteValue` counts a spring's healing, a
veil's ambush, pull strength, the expected far bonus and wall slam, and how
often a pure utility skill comes back, so bots take the rites that use them.

## What implementing them involves

1. Engine: done (above).
2. Champions: done. Kits in `packages/shared/src/index.ts`; art in
   [fighter-assets.md](../fighter-assets.md); raid tricks in
   [raid-roster-design.md](../raid-roster-design.md) §6; migration 052 lets
   them be portraits and farmers; migration 055 gives each the farm perk of
   the original of its element (`FARM_PERK_OF` in `packages/shared/src/farm.ts`). The list as planned: front, side and back art on the rig, portraits and selection
   art (`scripts/export-fighters.ts`), effects and illustrated icons for 40
   skills, fighter select, raid champion tricks, docs.
3. Skins: done. Each has 3 Common, 2 Rare, 1 Epic and 1 Mythical with three
   Awakening stages (`packages/shared/src/shop.ts`; art in
   `apps/client/src/skins/skin-art.ts`, `mythic-art.ts` and `skin-fx.ts`; shop
   rows in migrations 053 and 054; the catalog is in
   [raid-roster-design.md](../raid-roster-design.md) §10.6).
