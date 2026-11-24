# Starforged Sigil loading screen

Approved concept: option **H** from the loading-screen comparison in this task.
The production scene uses two independent image-generated plates: a dark blue
floating-rock starfield and a transparent gold eight-point compass with a cyan
crystal. All typography and loading controls are real HTML, not baked into art.

Runtime derivatives preserve the generated dimensions and transparency:

- `src/art/startup-starfield.webp`: landscape backdrop, WebP quality 88.
- `src/art/startup-sigil.webp`: transparent crest, WebP quality 90, alpha quality 100.

Original PNGs are preserved in the task's generated-image artifacts:
`exec-f9c9e715-117f-4358-abc9-dc094314d2c1.png` (background),
`exec-aa20913a-d2ee-40b9-896f-722cea544969.png` (crest).
The runtime files are imported by Vite for content-hashed URLs and PWA precaching.

The logo has two optically centered lines with equal tracking. The crest and
three SVG orbit paths float together by four pixels. All paths share the
crystal's center, with different tilts matching H, and use no nonuniform CSS
scaling or downward offset. Unbroken paths pulse softly; the aura
and six small particles provide restrained motion.
The background stays still. Reduced-motion preferences disable all motion.

The screen adapts its middle art area to the remaining height between the logo
and loading controls, including short landscape phones and safe-area insets.
Images are only requested if the startup overlay actually appears, and image
failure cannot block health checks, retries or entry into the game. The previous
one-minute connection-bar pacing remains unchanged.
