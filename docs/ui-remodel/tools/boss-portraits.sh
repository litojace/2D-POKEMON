#!/bin/bash
# Part of the UI remodel's step 5 (docs/ui-remodel/PLAN.md). Cuts each raid
# boss's vertical card picture (2:3, 600x900) from its wide splash painting,
# centred on the boss's "body" point in BOSS_FRAMES
# (apps/client/src/screens/raid-hall-view.ts). Needs ImageMagick.
# Run from the repo root after changing a painting or a framing point.
set -e
DIR=apps/client/src/art/raid-splash
# id  body-x (fraction of the painting's width)
while read -r id x; do
  W=1536 H=1024 CW=683
  left=$(awk -v x="$x" -v W=$W -v CW=$CW 'BEGIN{l=int(x*W-CW/2); if(l<0)l=0; if(l>W-CW)l=W-CW; print l}')
  convert "$DIR/$id.webp" -crop "${CW}x${H}+${left}+0" +repage \
    -resize 600x900 -quality 82 "$DIR/$id-portrait.webp"
  echo "$id: x=$x left=$left"
done <<'LIST'
grumblecrag 0.43
tidewyrm 0.61
gloomshade 0.57
somnara 0.54
prismatail 0.46
emberwing 0.49
storm-twins 0.50
LIST
