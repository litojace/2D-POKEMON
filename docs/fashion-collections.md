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

Each of the 18 Legendary Nova Vanguard suits has its own animated motif in
`epic-signature-fx.ts`, tied to its champion. The Abyssal Expedition and
Dream Carnival Epics keep the small glint every Epic has: motifs moving round
every fighter on a busy court read as clutter, so they stay a Legendary mark.

| Champion | Nova Vanguard motif |
| --- | --- |
| Voltkit | Pulse chevrons climbing above |
| Cindrake | Solar halo behind the head |
| Tidefin | Riptide crescent orbiting |
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
| Astrabun | Orbiting comet |
| Wombolder | Quake pulse |
| Shadopus | Oracle eye |
| Pangrove | Briar circle |
| Mossloth | Cloud cushions |

They draw on the rig's two Graphics layers, beside, behind, above the head or
on the ground, never over the face. Sizes come from the rig's head top and
shadow line, so they fit Shop previews and small battle fighters alike. With
the battle's ambient budget (one or two fighters, you first; none on Low)
they draw in full: at most 40 calls and a particle or two a second. Outside
it, and on Low, a compact version: at most 20 calls and no particles. An
ultimate swells the motif for 0.9 s and throws one burst of its own shape
with a ground ring. Defeated fighters draw nothing. Rares and Epics have no
motif; Mythicals keep their own Awakening effects. `epic-signature-fx.test.ts`
checks the budgets in every facing, that all 18 are distinct and no other skin has one, the ultimate
swell and the defeat case.

## Legendary: Nova Vanguard

Legendary sits between Epic (3,500) and Mythical (8,000) at 5,500 coins. Nova
Vanguard is the Legendary set: on top of its signature effect, each suit has
its own hero landing (a column of its light behind it, a ground ring, motes of
its motif) and victory (a fan of stars behind its head); both swell its motif
for 1.2 s. Epics have neither. Legendary has no Mythic Trial or Awakening.
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

Each captain has its own signature motif, and all of them land with an
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
| Pyranda | Spice Raider | Orbiting doubloons |
| Glacelle | Frost Privateer | Billowing sail |
| Halcyra | Crow's Nest Ace | Seagull wingman |
| Sunbara | Sunset Skipper | Shoulder parrot |
| Astrabun | Moonsail Bosun | Tiny moon galleon |
| Wombolder | Anchor Warden | Deck cannon smoke |
| Shadopus | Kraken Captain | Kraken tentacle |
| Pangrove | Jungle Corsair | Ringing ship's bell |
| Mossloth | Hammock Pirate | Swaying hammock |

Migration `20261118120000_sky_pirates.sql` adds the 18 skins and their set.

## Full-roster skin sets

Eight sets, one per collection that dresses all 18 champions in one design at
one rarity: Wayfarer, Moonlit Tea, Astral Court, Cyber Mecha, Abyssal
Expedition, Dream Carnival, Nova Vanguard and Sky Pirates (`SKIN_BUNDLES` in
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
