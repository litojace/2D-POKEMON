# Login background study

The login keeps its existing account card on the right. These are art-direction
options for selection, not a change to authentication or the published backdrop.

## Visual references examined

- Genshin Impact: [official start-screen screenshot](https://webstatic.hoyoverse.com/upload/uploadstatic/contentweb/20210129/2021012910273184435.jpg), from [HoYoverse's pre-installation notice](https://genshin.hoyoverse.com/id/news/detail/103836).
  A receding walkway and repeated pillars lead to one luminous door. Broad sky
  and cloud shapes support the small interface.
- Honkai: Star Rail: [login screenshot on MobyGames](https://cdn.mobygames.com/screenshots/18571532-honkai-star-rail-windows-login-screen.jpg).
  The train's diagonal creates movement, the planet supplies scale, and the dark
  sky supports a compact start prompt. The train is a world-specific identity.
- Wuthering Waves: [launch-version login screenshot in Michelle Kwan's review](https://medium.com/cros-s-play/mini-review-i-started-wuthering-waves-here-are-some-first-impressions-c0d1c145551f),
  plus [a later screen shared by a player](https://www.reddit.com/r/WutheringWaves/comments/1hrf6au/beautiful_finally_a_new_login_screen/).
  The launch screenshot uses a restrained cool palette, wide horizon and small
  figures. The later post highlights water reflecting the sky. These are
  version-specific references, not claims about the current shipped screen.

## Interpretation for this game

Use an environment-led scene with one memorable silhouette, a path into depth,
readable foreground/midground/distance and naturally quiet space behind the form.
Voltkit can supply scale as a small inhabitant rather than filling the image.
Retain the hand-painted creature-world aesthetic of the approved boss posters.

Four original concepts were presented as a 2×2 selection board:

| Position        | Concept            | Main idea                                                                                          |
| --------------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| A, top left     | Seven-element gate | Curved causeway, monumental raid gateway, seven elemental gems, small Voltkit                      |
| B, top right    | Elemental horizon  | River leads through one coherent world toward the arena; distant landmarks suggest the boss biomes |
| C, bottom left  | Mirror lake        | Still water, stepping stones and a single ring monument; the calmest visual option                 |
| D, bottom right | Guild plaza        | Cyan crystal fountain, warm guild windows, rain-wet paving and sleeping Voltkit                    |

A is recommended for a clear raid-game identity; D for a welcoming home base.
The selected direction should be generated as a full standalone background and
previewed with the actual login card on desktop and mobile before replacement.

## Selected implementation

The owner selected **B — Elemental horizon**. The final standalone painting
is served as `elemental-horizon.webp` (native 1672×941) and
`elemental-horizon-small.webp` (1024×576). The original generated painting is
`exec-5fa7c29d-b757-4142-a341-3411128f1d80.png` in this chat's image artifacts.

`welcome-scene.css` keeps the existing login layout and applies lobby-inspired
translucent blue glass to the account card, tabs and input wells. Login, signup
and recovery share these scoped styles. One backdrop blur is used on the card;
there is an opaque fallback when backdrop filtering is unsupported.
