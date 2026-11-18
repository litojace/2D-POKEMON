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
| Dream Carnival | Epic / 3,500 | Independent stagewear, masks, personal headpieces and ruffs; a small glint and confetti dash trail |
| Nova Vanguard | Legendary / 5,500 | Original hero suits, individual emblems and joint-mounted equipment; a signature effect, its own hero landing and victory, and a short movement trail |
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
beak remain intact. Carnival uses individually authored body colors distinct from the defaults,
paired with one cheerful costume hue and restrained gold trim. Costume
panels shade that same hue; gems share gold, avoiding extra rainbow accents.
Duskveil retains a dark void face.

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
time. Riot's VFX guidance puts readability first, so idle stays quiet.

- **Idle: light on the suit.** Nova Vanguard: energy runs up a seam into
  the chest emblem, which breathes. Sky Pirates: a glint sweeps the
  tricorne's gold brim, and the buckle holds a warm light that flashes a beat
  later. With the ambient budget, a few motes drift off (Nova's rise and
  slow; the pirates' gold dust settles).
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

The Abyssal Expedition and Dream Carnival Epics keep the small glint every
Epic has.

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
Vanguard is the Legendary set: on top of its signature effect, each suit has
its own hero landing (a column of its light behind it, a ground ring, motes of
its motif) and victory (a fan of stars behind its head); both summon its
motif. Epics have neither. Legendary has no Mythic Trial or Awakening.
Migration `20261118100000_legendary_skins_and_skin_sets.sql` allows the
rarity and moves the 18 suits to it; owners keep theirs.

## Legendary: Sky Pirates

The second Legendary collection (5,500 coins): a crew of sky-pirate
captains (`pirate-fashion.ts`, `pirate-art.ts`). Each keeps the champion's
own colours; the costume carries the theme. The silhouette is a tricorne,
sized to the chibi head with its crown above it, a gold edge, a compass-rose
emblem and a plume in the captain's colour, plus a gold-trimmed coat with a
frilled shirt, double buttons, a red sash and buckle, and a cutlass at the
hip. The hat replaces head-top props but keeps crests that are part of the
champion (the same list Nova Vanguard keeps). From behind, the coat's back and
tails sit on the scarf part, over shells and membranes.

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
`modern-viet.ts` for the rest). Champions keep their own colours.

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

Nine sets, one per collection that dresses all 18 champions in one theme at
one rarity: Wayfarer, Moonlit Tea, Astral Court, Cyber Mecha, Abyssal
Expedition, Dream Carnival, Nova Vanguard, Sky Pirates and Hồn Việt (`SKIN_BUNDLES` in
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
