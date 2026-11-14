# App Store screenshots

Six landscape screenshots of the real game, at the iPhone sizes App Store
Connect asks for, each framed under a short caption. They are rendered by a
script, so they can be made again whenever the game changes:

```bash
npx playwright test --config scripts/app-store/playwright.config.ts
```

The files land in `app-store-screenshots/` (not committed):

| Folder           | Display in App Store Connect                                       | Size (landscape) |
| ---------------- | ------------------------------------------------------------------ | ---------------- |
| `iphone-medium/` | iPhone with Dynamic Island, medium display (iPhone 16 / 17 Pro)    | 2622 × 1206      |
| `iphone-large/`  | iPhone with Dynamic Island, large display (iPhone 16 / 17 Pro Max) | 2868 × 1320      |
| `raw/`           | The captures before framing (also valid uploads)                   | as above         |

App Store Connect **requires** the medium display set, and accepts 1 to 10
screenshots per size in PNG or JPEG, without alpha channels. The large set
is optional: upload it too, so Pro Max owners see screenshots made at their
phone's size. Upload the files in their numbered order: the first is the
one people see first, in search results and on the product page. Sizes and
rules: [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications).

## The screenshots

1. **Battle giant raid bosses together**: four players against Emberwing in
   the air, its warnings on the floor.
2. **Real-time creature duels**: Pyranda against Glacelle in Tide Pools,
   both mid-cast (fire against ice, like the app icon).
3. **18 creatures, 9 elements**: the Fighters roster.
4. **2v2 teams and free-for-all**: a 2v2 in Shifting Ruins, Pyranda's
   ultimate landing.
5. **Hang out in the Plaza**: the Plaza at midday.
6. **Grow your own farm**: a sunny farm, every plot growing.

## How they are made

`scripts/app-store/screenshots.spec.ts` runs the real client in the visual
harness (`tests/visual`), signed in as "Blaze" with Pyranda as their
fighter. Battles are the real server simulation running in the page,
stepped one tick at a time with scripted inputs, so a run draws the same
frames. The browser emulates each iPhone: its size in points at 3x, touch,
and the safe-area insets around the Dynamic Island. Each capture is then
framed under its caption in the game's Barlow Condensed.

To change a shot, edit its scene in `SCENES` (its caption sits beside it).
`SCENES=duel,farm` renders only those; `RAID_BOSS` and `RAID_ATTACK` try
another boss.

App Review Guideline 2.3.3 asks that screenshots "show the app in use";
text overlays are allowed. Keep every shot a real screen of the game.
