# Rare and Epic fashion collections

Six collections add 108 champion skins: three Rare and three Epic for each of the
18 champions. Each champion now has 14 skins (3 Common, 5 Rare, 5 Epic and
1 Mythical). Common and Mythical designs and ownership are unchanged.

| Collection | Rarity / base coins | Clothing and effects |
| --- | --- | --- |
| Wayfarer | Rare / 1,500 | A trail pack whose bedroll shows either side of the head, a short field jacket with cross strap and belt, a red neckerchief, a hip satchel; a short dash leaf trail |
| Moonlit Tea | Rare / 1,500 | A wrapped kimono with long furisode sleeves, a wide obi whose butterfly bow fills the back, a kanzashi hairpin with dangling blossoms; a short petal dash trail |
| Astral Court | Rare / 1,500 | A long gold-trimmed velvet robe, a starry scalloped shoulder mantle with gold epaulettes, a floating star circlet; a short star trail, no idle effect |
| Abyssal Expedition | Epic / 3,500 | Independent pressure-suit construction, glass helmets, gauges, tanks and individual dive equipment; a small glass glint and bubble dash trail |
| Nova Vanguard | Legendary / 5,500 | Original hero suits, individual emblems and joint-mounted equipment; a signature effect, its own hero landing and victory, and a short movement trail |
| Stars & Stripes | Legendary / 5,500 | An American figure per champion in full costume with glowing pieces; a Walk-of-Fame landing, a fireworks victory, a motif per champion and a star trail |
| Neon Campus | Epic / 3,500 | A school club per champion with its kit; something on it lights up, a confetti dash trail |
| Hero Squad | Epic / 3,500 | An original hero per champion with its own powers on show; a glowing chest emblem, lit gear, a star dash trail |
| Hồn Việt | Legendary / 5,500 | A figure of Vietnamese heritage per champion in full costume with props of its story; glowing embroidery and lanterns, a drum landing, a lantern victory, a motif per champion and a petal trail |

## Color stories

Each collection recolors the champion through `fashion-art.ts` (`TINTS`): the
hue moves to the collection's own color while every color keeps the
champion's lightness, so dark markings stay dark and light markings stay
light (Duskveil's void face, Shadopus's visor, Pyranda's mask, Coilemur's
white face). Never set `accent` or `dark` to an unrelated pastel: champions
draw anatomy with them.

| Collection | Body | Costume fabric |
| --- | --- | --- |
| Wayfarer | Honey and russet | Field green, cream |
| Moonlit Tea | Blossom pink | Indigo silk (matcha on bulky champions) |
| Astral Court | Midnight indigo | Near-black velvet, gold trim, pale-blue glow |
| Abyssal Expedition | Deep-water teal | Pressure suit, aqua glow |

Rare coats replace the default scarf or towel, as Epic suits do.
`fashion-collections.test.ts` checks that the three Rares differ for every
champion and that `accent`/`dark` keep the champion's lightness.

## Individual tailoring

Each Rare collection has its own construction (`rare-fashion.ts`), so the
three read apart by silhouette at battle size, not just by colour. Pieces are
fitted to each champion's own torso cut (`fashion-fits.ts`, 54 front, side and
rear patterns) and head anchor in every facing, and sit on parts the rig keeps
steady: the body and the flame (head-top) part. A pack and hanging sleeves go
behind the part's own art (`UNDER` in `rare-fashion.ts`). From behind, shells
and glider membranes cover the back, so the pack, obi bow and mantle sit on the
scarf part, which is painted last there. Rare coats replace the default scarf.
`fashion-collections.test.ts` checks that no two Rare collections share more
than a fifth of their shapes for any champion or facing.

Epic equipment replaces conflicting default props, including Voltkit's goggles,
Tidefin's bandana and Sunbara's head ornament and towel. Cindrake has one
integrated crest per outfit. Epic collars and ruffs sit on the body behind the
head, so they do not cover beaks or faces. Organic ears, cheek fur and Halcyra's
beak remain intact.

Dream Carnival, the other Epic collection of that release, was retired on
18 Nov 2026 (migration `20261118170000_retire_dream_carnival.sql`): its
skins and set left the Shop, and anyone who had bought one got its price
back. Its drawing code in `epic-fashion.ts` is no longer reached.

## Animation and performance

The production articulated rig moves the clothing pieces with their joints.
Rare skins have no idle particle or drawing effect. Trails use the existing
dash particle budget; skills only
change color. These skins add no Mythical ornaments, Awakening stages,
full-screen flashes, large auras, changed hitboxes or ability timings.

## Legendary signature effects

Modelled on premium skins in League of Legends, Mobile Legends and Brawl
Stars: their effects live on the costume and on what the champion does
(abilities, movement, landing, victory), not on props circling it all the
time. Riot's VFX guidance puts readability first, so idle stays quiet on the
champion itself; the tier shows at the feet (the aura below).

- **Idle: light on the suit.** Nova Vanguard: energy runs up a seam into
  the chest emblem, which breathes. Sky Pirates: a glint sweeps the
  tricorne's gold brim, and the buckle holds a warm light that flashes a beat
  later. With the ambient budget, a few motes drift off (Nova's rise and
  slow; the pirates' gold dust settles).
- **A Legendary aura at rest**, so the tier reads from across the court
  and a 5,500-coin skin never looks like a 3,500 Epic (`legendaryAura` in
  `epic-signature-fx.ts`). On every graphics level: a pool of the skin's
  light under the feet, a rim in Legendary gold (`TIER_COLORS.legendary`)
  and a comet of light running round it. With the ambient budget: a second
  comet, four marks of the collection turning slowly on the rim (Nova's hex
  pips in the suit's glow, the pirates' gold compass points, Hồn Việt's
  drum suns, Stars & Stripes' red and blue stars), a soft light behind the
  shoulders and two glints rising beside the body, off the face. While the
  ultimate's motif is out it steps back to the pool and rim. It stays below
  a Mythical's Stage II rune circle and Stage III seal: one thin rim, no
  orbiting shards. Idle frames now draw at most 19 calls compact and 36
  full (budgets 20 and 40).
- **Moving: its own trail at the feet.** Nova: energy ripples, light streaks
  on a dash. Pirates: sea-spray puffs that bloom and thin out, and gold
  dust. The generic skin trail is off for these skins, so there is only one.
- **The champion's motif is summoned**, not worn: it pops in with a little
  overshoot as it fades up, holds and eases out over 1.9 s. Both sets show it
  on an ultimate; Nova also on its landing and victory (the pirates have
  their anchor and chest there).
- **Moments with weight.** Particles have drag, a size and colour ramp over
  their life, a fade-in, an eased fade-out and a sway (`stepParticle` and
  `drawAnyParticle` in `skin-fx.ts`). The anchor falls faster as it drops,
  rebounds when it bites, and throws a bloom of dust; the chest lid springs
  open past its rest and settles, glows, and doubloons arc up and fall back.

The Abyssal Expedition Epics keep the small glint every Epic has.

| Champion | Nova Vanguard motif |
| --- | --- |
| Voltkit | Pulse chevrons climbing above |
| Cindrake | Solar halo behind the head |
| Tidefin | Riptide crescent |
| Auralynx | Prism hex panels |
| Lumoth | Lumen beacon orbs |
| Mystowl | Living star chart |
| Terradon | Hex bulwark ring |
| Duskveil | Echo waves |
| Coilemur | Flux rings |
| Pyranda | Medic cross |
| Glacelle | Frost lattice |
| Halcyra | Gale vortex |
| Sunbara | Rising dawn |
| Astrabun | Comet |
| Wombolder | Quake pulse |
| Shadopus | Oracle eye |
| Pangrove | Briar circle |
| Mossloth | Cloud cushions |

They draw on the rig's two Graphics layers, beside, behind, above the head or
on the ground, never over the face. Sizes come from the rig's head top and
shadow line, so they fit Shop previews and small battle fighters alike. With
the battle's ambient budget (one or two fighters, you first; none on Low)
they draw in full: at most 40 calls and a few particles a second. Outside
it, and on Low, a compact version: at most 20 calls and no idle particles.
An ultimate also throws one burst of the motif's own shape with a ground
ring. Defeated fighters draw nothing. Rares and Epics have no
motif; Mythicals keep their own Awakening effects. `epic-signature-fx.test.ts`
checks the budgets in every facing, that all 36 are distinct and no other
skin has one, that idle draws no motif, the summoned motif and its fade
(never a negative size or alpha), the trail and the defeat case.

## Legendary: Nova Vanguard

Legendary sits between Epic (3,500) and Mythical (8,000) at 5,500 coins. Nova
Vanguard is a corps of eighteen heroes in one language (a suit with an
armoured chest plate whose seams carry light, the hero's mark on it, a
corps star on the belt, a spine of light from behind), each dressed for its
post with its own gear (`modern-vanguard.ts`): a courier's antenna and
satchel, a forger's hammer and sun core, a sentinel's hex shield and brow
crystals, a medic's drone, a crown of sun rays, a sonar dome, a rain
cloud... Each has a body colour of its own (`VANGUARD_TINTS`), and its
glow (`VANGUARD_LOOK`) colours its trail, skills and signature. Crests that
are part of the champion stay (Cindrake, Lumoth, Halcyra, Glacelle,
Pangrove), and champions keep their own weapons. On top of its signature
effect, each suit has its own hero landing (a column of its light behind it, a ground ring, motes of
its motif) and victory (a fan of stars behind its head); both summon its
motif. Epics have neither. Legendary has no Mythic Trial or Awakening.
Migration `20261118100000_legendary_skins_and_skin_sets.sql` allows the
rarity and moves the 18 suits to it; owners keep theirs.

## Legendary: Sky Pirates

The second Legendary collection (5,500 coins): a crew where every champion
holds its own post on the ship (`modern-pirates.ts`, `pirate-art.ts`), with
its own hat, coat, gear and glowing pieces, and a body colour chosen for it
(`PIRATE_TINTS`): a storm-grey corsair with a lit compass, a bicorne
admiral worn athwart, a quartermaster with a glowing treasure map, a ghost
whose torn hem glows, a kraken captain with bioluminescent spots, a
lookout in a knit cap with a lantern, a bosun with a moon pin and whistle,
a hammock pirate with string lights... Headwear has its real shape from
every side: a tricorne in profile is as deep as the head, its point
forward; the admiral's bicorne shows its end. Things worn on one side keep
their side from behind, and things on the face never show from behind.

Each captain has its own motif, summoned by its ultimate, and all of them land with an
anchor that drops beside them and bites the ground, and win with a treasure
chest that springs open behind them, doubloons flying up off the face.

| Champion | Captain | Signature |
| --- | --- | --- |
| Voltkit | Storm Corsair | Storm compass, needle crackling |
| Cindrake | Cinder Buccaneer | Swinging ship lantern |
| Tidefin | Tide Admiral | Ship's wheel turning behind |
| Auralynx | Prism Navigator | Spyglass catching the light |
| Lumoth | Lantern Lookout | Glowing message in a bottle |
| Mystowl | Chart Quartermaster | Treasure map with a pulsing X |
| Terradon | Ironhull Captain | Swinging anchor |
| Duskveil | Ghost Ship Wisp | Rippling ghost flag |
| Coilemur | Rigging Runner | Rope lasso overhead |
| Pyranda | Spice Raider | Doubloons |
| Glacelle | Frost Privateer | Billowing sail |
| Halcyra | Crow's Nest Ace | Seagull wingman |
| Sunbara | Sunset Skipper | Shoulder parrot |
| Astrabun | Moonsail Bosun | Tiny moon galleon |
| Wombolder | Anchor Warden | Deck cannon smoke |
| Shadopus | Kraken Captain | Kraken tentacle |
| Pangrove | Jungle Corsair | Ringing ship's bell |
| Mossloth | Hammock Pirate | Swaying hammock |

Migration `20261118120000_sky_pirates.sql` adds the 18 skins and their set.

## Legendary: Hồn Việt

Vietnamese heritage at 5,500 coins (`HON_VIET_SKINS` in `shop.ts`,
`viet-art.ts`), the third Legendary collection. Every champion is a figure of its own, chosen for who it is,
with its own costume and accessories (`modern-designs.ts` for five of them,
`modern-viet.ts` for the rest), and a body colour of its own (see Body
colours below).

| Champion | Skin | Figure and what glows |
| --- | --- | --- |
| Voltkit | Đèn Ông Sao | Trung Thu: áo bà ba, a star lantern on a pole (candle glow) |
| Cindrake | Thánh Gióng | Iron armour scales, its flame crest kept, a golden bamboo stalk with lit nodes |
| Tidefin | Hoa Đăng | Áo dài with carp-scale embroidery, nón lá crowned by a lotus lamp |
| Auralynx | Võ Sư Vovinam | Blue võ phục, glowing belt knot and tails, red headband |
| Lumoth | Đèn Lồng Hội An | Yellow áo dài with lantern embroidery, a silk lantern on each antenna |
| Mystowl | Liền Chị Quan Họ | Nón quai thao with shimmering tassels, yếm with gold embroidery, áo tứ thân |
| Terradon | Kim Quy | Áo dài for men with a Đông Sơn drum sun, khăn đóng, the returned sword glowing |
| Duskveil | Đèn Kéo Quân | Áo the of dark gauze, a revolving lantern whose panes light in turn |
| Coilemur | Nghệ Nhân Đàn Bầu | Brown áo the, the monochord on the back with a humming lit string |
| Pyranda | Hạt Dẻ Phố Cổ | Khăn mỏ quạ, a shoulder pole with baskets of chestnuts glowing like embers |
| Glacelle | Sương Sa Pa | Indigo H'Mông blouse with embroidered bands, a silver neck ring that shines |
| Halcyra | Chim Lạc Đông Sơn | A crown of Lạc-bird feathers lit at the tips, a bronze drum-sun breastplate |
| Sunbara | Xuân Hoa Mai | Red áo dài with twinkling hoa mai, khăn vấn, the yuzu kept as a Tết quất |
| Astrabun | Thỏ Ngọc Cung Trăng | White áo dài with moon and clouds, a full moon glowing behind the head, a mooncake |
| Wombolder | Mùa Lúa Chín | Áo nâu, a gùi of ripe rice whose grains twinkle |
| Shadopus | Tướng Hát Bội | Pheasant plumes, four command flags with lit borders |
| Pangrove | Đầm Sen Đồng Tháp | Pink áo bà ba, a lotus leaf worn as a hat with a glowing bud |
| Mossloth | Ông Đồ | Black áo the, round spectacles, a calligraphy scroll whose ink glows |

As a Legendary each costume also wears a gold-embroidered silk sash whose
stitches light in a run, and some champions trade their own prop for one of
their story (`modern-viet-legend.ts`): Astrabun's mallet becomes a Trung Thu
rabbit lantern on a bamboo rod (its head repainted, a lantern drawn over it),
Sunbara's yuzu a crown of hoa mai, Tidefin holds a lotus lamp, and Terradon's
shell turns to Kim Quy's gold.

The glowing pieces are marked `lume` and light up in play (see Glowing costume
pieces below). The signature effects (`epic-signature-fx.ts`, table `viet`):

- Landing: the face of a Đông Sơn bronze drum (its 14-ray sun inside rings)
  lights up under the feet, spreads and fades, with a burst of mai and đào
  petals behind.
- Victory: three paper lanterns rise one after another behind the champion,
  swaying, as petals fall.
- Ultimate: the champion's own motif pops in for 1.9 s (star lanterns
  circling, Thánh Gióng's bamboo, floating lotus lamps, a Vovinam lotus
  ring, a string of Hội An lanterns, a spinning nón quai thao, the returned
  sword, revolving lantern figures, a monochord wave, chestnut embers,
  silver rings, Lạc birds, a hoa mai in bloom, the full moon and jade pestle,
  ripe rice, the general's flags, a lotus pond, a calligraphy stroke).
- Moving: a trail of petals at the feet; idle, a soft gold glint at the
  collar and, with the ambient budget, a petal now and then. Names are
Vietnamese: the display face loads its Vietnamese letters
(`barlow-condensed-vietnamese-*.woff2`), and one-line names leave room in
their clip for marks above and below. Migration
`20261118140000_hon_viet.sql` adds the skins and their set.

## Epic: Hero Squad

Original superheroes at 3,500 coins (`HERO_SQUAD_SKINS` in `shop.ts`,
`hero-art.ts`). The squad shares one language: a suit with a glowing chest
emblem on a white diamond plate and a lit belt buckle. Each hero shows its
own power (`modern-designs.ts` for five of them, `modern-hero.ts` for the
rest). Every name and mark is original; nothing borrows a published hero's.

| Champion | Hero | Its own power, and what glows |
| --- | --- | --- |
| Voltkit | Volt Streak | A winged visor; a lightning bolt running down the suit |
| Cindrake | Blaze Breaker | A vented collar with magma lit in a run; its flame crest kept as the hero's hair |
| Tidefin | Tide Guardian | A fin-crested helm lit along its edge, a trident emblem, a belt of wave lights |
| Auralynx | Prism Fist | Crystal pauldrons, a gem emblem and a crystal on the brow |
| Lumoth | Lumina | A lantern-core emblem, a glittering sash, a star tiara between the antennae |
| Mystowl | Third Eye | A star-lined high collar cape, a rune amulet, a circlet with a gem |
| Terradon | Iron Bulwark | Stone pauldrons and chest plate with lava in the cracks, a horned helm |
| Duskveil | Duskwatch | A dark cape lit along its edge, a crescent emblem |
| Coilemur | Magnetail | A magnet emblem, coil stripes lit in a run, arc earpieces |
| Pyranda | Chestnut Comet | Aviator goggles with lit lenses, a launcher on the back with an ember at its mouth |
| Glacelle | Frost Sentinel | An ice crown whose spikes light in turn, a snowflake emblem, a frosted cape |
| Halcyra | Skysight | A targeting lens with a lit crosshair, a wing emblem, a streaming scarf |
| Sunbara | Solar Flare | The yuzu as a solar core ringed with running rays, a sun emblem, a short cape |
| Astrabun | Moon Blink | A crescent moon between the ears, a belt of moon phases lit in turn |
| Wombolder | Bulldozer | A hard-hat helmet with a headlamp, a belt of hazard stripes running in light |
| Shadopus | Inkshade | An ink-drop emblem, a ninja headband with streaming tails, smoke pellets |
| Pangrove | Leaf Ranger | Leaf armour, a crown of leaves with lit veins |
| Mossloth | Chrono Keeper | A clock emblem whose hand sweeps in light, a pocket-watch chain, a gear halo |

A short star trail on a dash. Migration `20261118160000_hero_squad.sql` adds
the skins and their set.

## Legendary: Stars & Stripes

American popular culture at 5,500 coins (`STARS_STRIPES_SKINS` in
`shop.ts`, `stars-art.ts`), the fourth Legendary collection. Every champion
is a figure of its own (`modern-designs.ts` for five of them,
`modern-stars.ts` for the rest), with glowing pieces (lume layers):

| Champion | Skin | Its motif on the ultimate |
| --- | --- | --- |
| Voltkit | Space Ranger | A rocket climbing behind |
| Cindrake | Hot-Rod Racer | A checkered flag |
| Tidefin | Malibu Surfer | A curling wave |
| Auralynx | Jazz Cat | Notes rising from the saxophone |
| Lumoth | Neon Diner | A neon milkshake sign |
| Mystowl | Lady Liberty | The torch raised high |
| Terradon | Sheriff | A sheriff's star turning on the ground |
| Duskveil | Film Noir | A film reel |
| Coilemur | Rodeo Rider | A lasso loop overhead |
| Pyranda | Ace Pitcher | A fastball streaking round |
| Glacelle | Aurora Alaska | Northern lights |
| Halcyra | Barnstormer | A biplane looping with a smoke trail |
| Sunbara | Fourth of July | A sparkler fountain |
| Astrabun | Stage Magician | A fan of playing cards |
| Wombolder | Linebacker | A spiral pass |
| Shadopus | Times Square DJ | Equalizer bars |
| Pangrove | Park Ranger | A ridge of pines round a campfire glow |
| Mossloth | Woodstock Folk | A ring of flowers |

Landing: a pink terrazzo star with a gold rim lights up under the feet like
one on the Walk of Fame while two spotlights sweep behind. Victory: three
fireworks rise behind and burst into rings of red, white and blue. Moving: a
trail of red, white and blue star sparks. Migration
`20261118190000_stars_stripes.sql` adds the skins and their set.

## Epic: Neon Campus

One school at 3,500 coins (`NEON_CAMPUS_SKINS` in `shop.ts`,
`campus-art.ts`), and a club of its own for every champion, its kit carrying
something that lights up (`modern-designs.ts` for five of them,
`modern-campus.ts` for the rest).

| Champion | Skin | Club, and what glows |
| --- | --- | --- |
| Voltkit | Game Club Ace | A hoodie with circuit traces lit in a run, a cat-ear LED headset |
| Cindrake | Lab Prodigy | A lab coat, safety goggles, a bubbling flask; its flame crest kept |
| Tidefin | Swim Team Star | A swim cap with goggles whose lenses glow, a track jacket and towel |
| Auralynx | Council President | A blazer, an armband and a glowing council badge, a ribbon |
| Lumoth | Photo Club Snap | A cardigan, a camera whose flash blinks |
| Mystowl | Library Prefect | Round glasses that catch the light, an argyle vest, a prefect pin |
| Terradon | Team Captain | A jersey with a lit number, a sweatband with a glowing stripe, a whistle |
| Duskveil | Drama Club Lead | A velvet cape, a lit brooch of the two theatre masks, a beret |
| Coilemur | Robotics Whiz | Overalls with a tool belt, a robot badge with blinking eyes, an antenna light |
| Pyranda | Bake Club Chef | An apron and toque, a cupcake with a lit candle |
| Glacelle | Choir Soloist | A choir robe and stole with music notes that twinkle |
| Halcyra | Archery Ace | A chest guard, a quiver whose arrow tips glow, a sweatband |
| Sunbara | Art Club Painter | A beret in place of the yuzu, a smock with glow-in-the-dark paint |
| Astrabun | Stargazer | A navy pinafore with constellation pins lit in turn, a telescope |
| Wombolder | Garden Club Keeper | Overalls, a straw hat, a seedling whose first leaves glow |
| Shadopus | Mystery Club Sleuth | A deerstalker, a magnifying glass whose lens glints |
| Pangrove | Band Drummer | A shako with a plume, a drum whose rim lights run round |
| Mossloth | Nap Club Captain | Pyjamas, a nightcap with a glowing star pom, a sleep mask |

A short confetti trail on a dash. Migration `20261118180000_neon_campus.sql`
adds the skins and their set.

## Body colours

Every Legendary and modern Epic collection (Nova Vanguard, Sky Pirates,
Hồn Việt, Stars & Stripes, Hero Squad and Neon Campus) gives every
champion a body colour chosen for its figure (`collection-colours.ts`,
`PIRATE_TINTS`, `VANGUARD_TINTS`): a
gold Kim Quy, a lotus-pink Hoa Đăng, a candy-red hot-rod racer, a
copper-green Lady Liberty, a magnet-red Magnetail, a velvet-red drama lead.
`tintPalette` (`fashion-art.ts`) moves the champion's light, mid, dark and
accent colours toward that hue and keeps their lightness, so faces, eyes,
cheeks and markings read the same; the glow colour is kept. Within a
collection the hues are spread so no two champions look alike.

## Glowing costume pieces

A costume marks pieces that give off light with
`<g class="lume" data-lume="pulse|blink|chase|twinkle" data-i="n">`. The part's
texture shows them lit; `rigAssets` adds a light layer per way of glowing
(chases, blinks and twinkles split into even and odd lights), the part's own
drawing with only those pieces showing and a soft glow, at the part's crop.
`FighterRig` lays each over its part with additive blending and fades it over
time (`lumeStrength`): pulses breathe, chases alternate like marquee bulbs,
twinkles glint, blinks flash once a second per light (under the
three-flashes-a-second line). Only fighters with the ambient budget get the
layers (none on Low). `lume-layers.test.ts` checks the layers, their crops and
the timings.

## Full-roster skin sets

Eleven sets, one per collection that dresses all 18 champions in one theme
at one rarity: Wayfarer, Moonlit Tea, Astral Court, Cyber Mecha, Abyssal
Expedition, Nova Vanguard, Sky Pirates, Hồn Việt, Hero Squad, Neon Campus
and Stars & Stripes (`SKIN_BUNDLES` in
`shop.ts`).
Like the Look sets, a set costs 80% of the skins you don't own yet (the
database's `arena_item_price`); buying one grants each skin, and a complete
Cyber Mecha set earns its frame as usual. Void Knight Mythicals are never
bundled: each opens with its own champion's Mythic Trial. Sets show in the
Shop's Collections tab, under the Look sets, with the fighter you're trying
on in each set's skin, and among the Today tab's Bundles.

## Shipping

The three migrations `20261117170000_fashion_collections.sql`,
`20261117170001_distinct_epic_collections.sql` and
`20261117170002_nova_vanguard.sql` ship with the client. The main-branch
migration workflow applies them automatically. They add 108 sellable rows and
can run again without changing ownership or balances. The second migration
retires Clockwork Reverie without deleting ownership. These champion costume
collections do not promise universal cosmetic bundles or completion frames.

Relevant validation: `fashion-collections`, `shop-catalog`, `skin-art`,
`fitting-room`, `shop-ui`, `skin-loading`, `skin-effects-budget` unit tests;
`shop-storage` integration test; `fashion-collections.spec.ts` visual flow on
1440×900 and 844×390. The review lookbook also checks garment crop bounds
against the actual per-part rig assets in all four facings.

## Nova Vanguard original hero collection

`hero-fashion-preview.ts` and `vanguard-equipment.ts` author 18 original hero
costumes with individual emblems, equipment and front/profile/rear construction.
The preview reuses native anatomy, facing depth order and joint coordinates.
It clears conflicting props, preserves organic ears, cheek fur and beaks, and
provides a modest idle/walk demonstration. Costume pieces fit the actual rig
crop boxes across all 72 views. Shop, Wardrobe and battles use the production
skin renderer; the review wrapper calls that same renderer.

`vanguard-fx.ts` supplies the suit lights shown in the review sheet's
preview (follow the body and limb joints, at most 32 drawing calls). In the
Shop and in battle, the signature effect above replaces them.

| Champion | Costume | Signature equipment |
| --- | --- | --- |
| Voltkit | Pulse Courier | Conductive ear coils, pulse vest and tail clasp |
| Cindrake | Solar Forger | Asymmetric forge mantle, vented gauntlet and furnace clasp |
| Tidefin | Riptide Ranger | Hydrofoil cape, gill fittings and a replacement fin tool |
| Auralynx | Prism Sentinel | Split prism browpiece and articulated hexagonal bracers |
| Lumoth | Lumen Warden | Wing lanterns, ribbed light pod and antenna neck fittings |
| Mystowl | Night Cartographer | Folded flight cape, rear constellation map and wrist folio |
| Terradon | Bulwark Grove | Hexagonal seed shield on the shell and root bracers |
| Duskveil | Echo Beacon | Acoustic hood hardware and a cage on its actual tail lantern |
| Coilemur | Flux Runner | Twin induction spools, ear coils and speed greaves |
| Pyranda | Cinder Medic | Petal rescue emblem, supply pack and healing pod |
| Glacelle | Frost Weaver | Lattice ice mantle, woven panels and ribbon combs |
| Halcyra | Gale Captain | Navigation crest, wing-tip fins and directional flight harness |
| Sunbara | Dawn Defender | Folded solar canopy, sunrise tabard and asymmetric poncho |
| Astrabun | Comet Strider | Forked comet baton replacing the mallet and glide boots |
| Wombolder | Quake Marshal | Compression gauntlets, reinforced brow and rear impact core |
| Shadopus | Deepwatch Oracle | Shell sensory crown, pearl cuffs and an oracle pod |
| Pangrove | Briar Bastion | Layered leaf shield, sprout comb and angular forearm bucklers |
| Mossloth | Cloud Keeper | Cushioned cloud cape, soft mitts and a folded cap |
