# Raid Hall sculpture upgrade

All seven flat grey crest statues are replaced with individual carved stone
illustrations: faceted Grumblecrag, coiled Tidewyrm, floppy-eared Gloomshade with
its crescent tail, Somnara with its cottage and nightcap, crystal-fan Prismatail,
flame-crested Emberwing and the paired Storm Twins.

The pale stone, carved recesses and gold inlays match the HD architecture and
existing pedestals. Native filtered textures preserve detail when zooming in
and avoid shimmering at map scale. Each complete sculpture remains static;
the existing restrained elemental uplight is retained.

Foot anchors come from each exported illustration's opaque support, rather
than the middle of the image box. Wide wave/cloud supports fit within the cap,
while tall horns and tail fans stay inside the original scenery envelope.
The boss names remain engraved within their existing plaques.
The Raid Hall caption wraps within the central aisle so it clears Somnara's
tail and Prismatail's crystal fan.

Production PNG masters and reproducible export instructions are in
`apps/client/art-source/town/boss-statues/README.md`.

Validation: shared/client/server build, offline precache check and 94 client
tests. Browser checks confirm all seven shipped source files, native filtered
images, centred foot contact on every pedestal, support widths, intact boss
plaques and the overall texture budget. Actual town screenshots cover desktop
and installed-iPhone emulation. WebKit's Home Screen resume and Town → battle
→ Town test also passes with the new images loaded. Hardware iPhone testing
remains separate.

Client captures: [all seven statues](town-boss-statues.webp),
[left group](town-boss-statues-left.webp), [right group](town-boss-statues-right.webp)
and [mobile](town-boss-statues-mobile.webp).
