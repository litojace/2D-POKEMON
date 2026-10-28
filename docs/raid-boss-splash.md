# Raid Hub boss illustrations

All seven bosses have a dedicated static introduction image. Grumblecrag uses
the approved mountain-coliseum illustration. The remaining images follow the
same painterly style, using each boss's existing battle atlas as identity reference:

- Tidewyrm: a moonlit tidal vortex and drowned temple.
- Gloomshade: haunted ruins, shadow hands and its golden crescent tail.
- Somnara: clouds, dream ripples and the cottage on its back.
- Prismatail: a mirror temple and a crystal fan scattering sunlight.
- Emberwing: volcanic ruins and a ring of fire, with room for both wings.
- Storm Twins: gold and blue spirits joined by lightning in a storm temple.

The illustrations contain no repeated titles or UI text. Game encounters and
boss animation assets are unchanged. The approved splash is used in the boss
showcase; the overview grid and roster use separate 320px thumbnails. Boss-specific
thumbnail framing keeps faces recognizable. Images are WebP, decoded asynchronously;
only the selected showcase uses the full-size illustration. Thumbnails load lazily.

PC keeps the image at its natural 3:2 aspect ratio. Landscape phones reserve a wider
image column so the camera does not zoom into a face; very short screens contain
the complete picture inside the space above the action footer. Portrait uses 3:2.

Asset locations: `apps/client/src/art/raid-splash/`, mapping in
`apps/client/src/raid-splash-art.ts`. Original generation files remain in the session
workspace's `generated_images` directory; the repository contains optimized WebP
exports only.
