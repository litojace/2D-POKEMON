# Plaza night login painting

`plaza-night.png` is the original 1672×941 static illustration, generated using
the game's approved fountain/plaza and former navy/gold welcome art as visual
references. Characters and interface elements are deliberately absent.

The fountain sits in the left third, with clear sky above for the brand and a
quiet right half behind the account card. Use the entire picture with a
left-centred cover crop; do not position characters over it or animate it.

Production exports:

```sh
magick apps/client/art-source/welcome/plaza-night.png -quality 89 apps/client/public/assets/backgrounds/plaza-night.webp
magick apps/client/art-source/welcome/plaza-night.png -resize 1024x -quality 87 apps/client/public/assets/backgrounds/plaza-night-small.webp
```

Keep the original source when regenerating the compressed WebP copies.

## Voltkit preview

`plaza-night-voltkit.png` adds one seated Voltkit on the foreground stone step,
with matching lantern light, cyan reflections and an attached contact shadow.
It is a review variant; the active background still uses `plaza-night.png`.

Actual form previews: [desktop](../../../../docs/login-voltkit-desktop.webp)
and [landscape phone](../../../../docs/login-voltkit-phone.webp). The preview
uses the same static illustration, without a separate character layer or animation.
