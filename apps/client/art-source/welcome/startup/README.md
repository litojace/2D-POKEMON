# Startup screen artwork

Since 27 Nov 2026 the startup screens have **no artwork of their own**
(the owner's call). The boot screen (`apps/client/index.html`) and the
startup curtain (`src/server-connection.css`) are drawn in the Poster look:
ink, gold, Anton capitals and a square bar, on the gold cover in halftone.
The one picture on them is the runner: the player's fighter in the game's
own side view (`src/startup-runner.ts`, drawn by `creatureSvg`), so nothing
is downloaded for it.

Later starts show a painting behind the curtain, chosen and downloaded by
the start before. Those are `src/art/startup-art-*.webp`, listed with who is
in them in `src/loading-art.ts`; how they were made is in
`docs/loading-art-prompts.md`.

## What was here before

Concept H, "Starforged Sigil" (shipped until 27 Nov 2026): a navy
floating-rock starfield (`src/art/startup-starfield.webp`) and a transparent
gold compass crest with a cyan crystal (`src/art/startup-sigil.webp`), with
three SVG orbits, an aura and six sparks floating around it. Both pictures
and their code were removed; they are in git history before that date if
ever wanted again. The original PNGs were never in the repository (they were
in the generating task's image artifacts).

See `docs/loading-screens.md`, "How the startup screens look", for the
current design.
