# Plaza night login painting

`plaza-night.png` is the original 1672×941 environment illustration, generated using
the game's approved fountain/plaza and former navy/gold welcome art as visual
references. It is retained as the environment-only source study.

The active login uses `plaza-night-voltkit.png`, which adds one seated Voltkit
on the foreground stone step with matching lantern light, cyan reflections
and an attached contact shadow. The character is part of the static painting.

The fountain sits in the left third, with clear sky above for the brand and a
quiet right half behind the account card. Use the entire picture with a
left-centred cover crop so Voltkit stays visible beside the account card.

Production exports:

```sh
magick apps/client/art-source/welcome/plaza-night-voltkit.png -quality 89 apps/client/public/assets/backgrounds/plaza-night-voltkit.webp
magick apps/client/art-source/welcome/plaza-night-voltkit.png -resize 1024x -quality 87 apps/client/public/assets/backgrounds/plaza-night-voltkit-small.webp
```

Keep the original source when regenerating the compressed WebP copies.

## Actual screen previews

Actual form previews: [desktop](../../../../docs/login-voltkit-desktop.webp)
and [landscape phone](../../../../docs/login-voltkit-phone.webp). The preview
uses the same static illustration, without a separate character layer or animation.
