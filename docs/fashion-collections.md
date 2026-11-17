# Rare and Epic fashion collections

Six collections add 108 champion skins: three Rare and three Epic for each of the
18 champions. Each champion now has 14 skins (3 Common, 5 Rare, 5 Epic and
1 Mythical). Common and Mythical designs and ownership are unchanged.

| Collection | Rarity / base coins | Clothing and effects |
| --- | --- | --- |
| Wayfarer | Rare / 1,500 | Field jackets, leather equipment, compass badges; a short dash leaf trail |
| Moonlit Tea | Rare / 1,500 | Crossed silk, blossom ornaments and tied details; a short petal dash trail |
| Astral Court | Rare / 1,500 | Original midnight cloth, constellation embroidery and individual crystal fittings; a short star trail, no idle effect |
| Abyssal Expedition | Epic / 3,500 | Independent pressure-suit construction, glass helmets, gauges, tanks and individual dive equipment; a small glass glint and bubble dash trail |
| Dream Carnival | Epic / 3,500 | Independent stagewear, masks, personal headpieces and ruffs; a small glint and confetti dash trail |
| Nova Vanguard | Epic / 3,500 | Original hero suits, individual emblems and joint-mounted equipment; personal energy details and a short movement trail |

## Individual tailoring

The collection shares a fabric language, not a single costume pasted onto all
champions. `fashion-fits.ts` contains 54 authored garment cuts: front, side and
rear for each champion. The opposite side follows the corresponding anatomy.
`fashion-signatures.ts` supplies the Rare equipment; `epic-fashion.ts` supplies wholly separate Epic suit, mask and headpiece construction. Both mount separate equipment on body, scarf, head,
ears, wing and wrist joints as appropriate.

| Champion | Individual construction |
| --- | --- |
| Voltkit | Split field jacket, trim around the original goggles, rear equipment bag |
| Cindrake | Open crest, horn sleeves, notched back and a heatproof neck clasp |
| Tidefin | Asymmetric sailor cut, frond clasps and a blade guard |
| Auralynx | Pointed monk's vest, ear-tip settings and separate crystal wrist jewellery |
| Lumoth | Short wing-root bolero, antenna pendants and wing clasps |
| Mystowl | Feathered mantle, plume comb and an archive clasp |
| Terradon | Short apron in front, open shell harness at the back, side equipment panel |
| Duskveil | Uneven spirit robe, embroidered hood seam and side clasp; no second hat |
| Coilemur | Narrow acrobat's vest, coil fittings, diagonal harness and rear spool pack |
| Pyranda | Wrapped jacket, slouch beret, a rear panel and crossed straps |
| Glacelle | Scalloped bell skirt, curved comb and pearl chain |
| Halcyra | Short flight cut, feather fastening and tapered rear lappets |
| Sunbara | Rounded host's coat, low boater and a soft neck wrap |
| Astrabun | Short rabbit vest, ear tie and a rear pompom clasp |
| Wombolder | Broad utility coat, reinforced brow helmet and suspenders |
| Shadopus | Small scalloped caplet, soft cap and a three-part chest chain |
| Pangrove | Overlapping leaf cut, paired temple leaves and scale-shaped collar |
| Mossloth | Uneven soft poncho, slouch cap and folded neck wrap |

The front shows closures and jewellery; the rear shows construction, bags,
straps and cape panels. Side fittings move to the visible anatomical root.
Tidefin's blade guard, Auralynx's wrist ornaments and Lumoth's wing clasps
remain attached through every facing. No artwork is baked into the eyes.

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
Rare skins have no idle particle or drawing effect. All 90 Epic
skins now have personal signatures: up to 20 drawing calls for their essential
Low-quality identity, up to 64 for the full layered effect, and no idle particles. Trails use the existing dash particle budget; skills only
change color. These skins add no Mythical ornaments, Awakening stages,
full-screen flashes, large auras, changed hitboxes or ability timings.

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

`epic-signatures.ts`, `epic-glyphs.ts` and `epic-skin-fx.ts` replace shared Epic
glints with 90 distinct signatures, including the original and Cyber skins.
Each signature combines an authored creature / costume motif, its material
language and animation, and a personal movement stamp. Abyssal uses currents
and sonar bubbles; Carnival uses props and ribbons; Cyber uses tracking
brackets and circuit scans; Nova projects its hero emblems. Original Epics
keep their own subjects (ice, clockwork, neon, aurora, paper, sap and so on).

The essential emblem stays visible at Low instead of disappearing with the
ambient budget. Full details use the existing one/two-fighter cap (you first),
fit a 64-call ceiling and add no idle particles. That deliberately replaces the
previous 32-call, barely visible Nova details with larger, higher-contrast
shapes while retaining a 20-call Low ceiling. Reduced Motion skips battle
animation as before. Details stay below faces, are drawn on existing pooled
Graphics layers, and leave attacks, hitboxes and their warnings unchanged.

Town uses the same frame plans on its existing canvas: full detail for the
local player at High, essential identities for up to three nearby real players
(one at Low). No per-frame image baking or pixel reads are introduced.

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
