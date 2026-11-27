# Instagram starter pack

The game's first Instagram account, free: a handle, a bio, the profile
picture, nine posts with captions, and three weeks of posting. The owner
creates the account (password, verification codes, CAPTCHA) and approves
every post before it goes out.

Rules for everything posted (owner, 27 Nov): only the name Element Arena
and the game's own art and characters. Never compare the game with another
game or company, and never use their names or hashtags.

## Make the pictures

The posts are built from the game's painted art, real captures of the game
and the game's fonts, so they can be made again when the game changes:

```bash
npx playwright test --config scripts/site-clips/playwright.config.ts scripts/site-clips/scenes.spec.ts
node scripts/instagram/make-posts.mjs
```

The first command records the real battles (the same captures as the
website's "Ways to play", about 7 minutes). The pictures land in
`instagram/` (not committed): `profile-picture.png`, and each post as
`NN-name-feed.jpg` (1080 × 1350, 4:5), `-square.jpg` (1080 × 1080) and
`-story.jpg` (1080 × 1920). Post the **feed** version; use the **story**
version for Stories. The profile grid shows posts cropped to 3:4, so every
word sits 84 px or more from the left and right edges.

To change a post, edit its entry in `POSTS` in
`scripts/instagram/make-posts.mjs`; `POSTS=6 node scripts/instagram/make-posts.mjs`
makes only that one.

## The profile

- **Handle**, the first one free: `@elementarena`, `@elementarenagame`,
  `@playelementarena`, `@elementarenausa` (matches the website).
- **Name**: Element Arena
- **Category** (professional account): Video Game
- **Bio** (Instagram allows 150 characters; this is 102):

  ```
  Real-time creature battles ⚔️
  18 creatures · 9 elements · 7 raid bosses
  Free to play in your browser 👇
  ```

- **Link**: https://elementarenausa.com
- **Profile picture**: `instagram/profile-picture.png`, the app icon's
  circle-safe drawing (Instagram shows it in a circle).

Switch the account to a **professional account** (Settings and activity → Account type
and tools → Switch to professional account, free; pick Creator or Business,
category Video Game). That unlocks insights and post scheduling.

## The nine posts

Hashtags: at most five per post. Reports since December 2025 say
Instagram caps posts at five; five works under either rule.

### 1. Welcome (painted art, the duel at dusk)

```
Pick an element. Outplay your friends. ⚔️

Element Arena is a real-time creature battle game: 18 original creatures across 9 elements, live 1v1 duels, 2v2 team fights and raid bosses.

Free to play in your browser on phone, tablet or computer. No download. Link in bio.

#ElementArena #indiegame #mobilegame #pvp #browsergame
```

### 2. Duels (real capture)

```
Dodge. Dash. Land the big one. ⚡

Every duel is live: aim your skills, read your rival and time your ultimate. No turns, no waiting.

Play free, link in bio.

#ElementArena #pvp #indiegame #mobilegame #gamedev
```

### 3. The roster

```
18 creatures. 9 elements. 🔥💧⚡🌿

Fire, Water, Electric, Nature, Earth, Light, Shadow, Psychic and Aura, two champions each, every one with its own kit.

Who are you picking first? Tell us in the comments 👇

#ElementArena #indiegame #mobilegame #characterdesign #pvp
```

### 4. Raid boss: Lumiwick (painted art)

```
Seven bosses, seven puzzles. 🏮

Meet Lumiwick, a lantern with a temper. Every raid boss has one trick to learn: solve it solo or bring up to three friends.

Start with Cragmuff: one clear opens the other six.

#ElementArena #raidboss #indiegame #mobilegame #coop
```

### 5. 2v2 teams (real capture)

```
Better with a friend. 🤝

Team up in 2v2, stack your skills and wipe the other side. Tag the friend you'd queue with.

Play free, link in bio.

#ElementArena #pvp #indiegame #mobilegame #multiplayer
```

### 6. Champion spotlight: Pyranda

```
Champion spotlight: Pyranda 🔥

A shy red panda with a flame at the tip of its tail. Lobs burning chestnuts from the back line.

🌰 Chestnut Mortar: a burning chestnut over walls
🔥 Hot Coals: a patch that burns anyone in it
🧱 Ember Curtain: a wall of embers that burns up enemy shots
💥 Chestnut Storm (ultimate): five blasts march across the arena

Who should we spotlight next?

#ElementArena #indiegame #mobilegame #characterdesign #pvp
```

### 7. Free-for-all (real capture)

```
Four fighters. One winner. 🏆

Everyone against everyone in the Ember Forge. Watch your back.

Play free, link in bio.

#ElementArena #pvp #indiegame #mobilegame #battlegame
```

### 8. The Shop: Mythical skins

```
Walk in a legend. ✨

Ashen Warlord, Abyssal Reaver, Hellforge: costumes with their own entrance and victory. Try anything on before you spend a coin.

All cosmetic, never stronger.

#ElementArena #indiegame #mobilegame #characterdesign #gameart
```

### 9. The Spire (real capture)

```
70 floors. How high can you climb? 🗼

Seven zones of ten floors, with an elite halfway up and a boss at the top of each.

Play free, link in bio.

#ElementArena #indiegame #mobilegame #indiedev #gamedev
```

## Posting plan (US Pacific time)

Launch with three posts on the first day, so a visitor from the website
finds a full first row, then three a week: Monday, Wednesday and Friday at
6:00 PM PT (after school and work on the West Coast, 9 PM on the East
Coast). The day after each post, share its story version at 12:00 PM PT
with a link sticker to https://play.elementarenausa.com.

| Date (PT)           | Post                   |
| ------------------- | ---------------------- |
| Mon 30 Nov, 4:00 PM | 1. Welcome             |
| Mon 30 Nov, 5:00 PM | 2. Duels               |
| Mon 30 Nov, 6:00 PM | 3. The roster          |
| Wed 2 Dec, 6:00 PM  | 4. Raid boss: Lumiwick |
| Fri 4 Dec, 6:00 PM  | 5. 2v2 teams           |
| Mon 7 Dec, 6:00 PM  | 6. Pyranda             |
| Wed 9 Dec, 6:00 PM  | 7. Free-for-all        |
| Fri 11 Dec, 6:00 PM | 8. The Shop            |
| Mon 14 Dec, 6:00 PM | 9. The Spire           |

The grid shows the newest post first, so after launch day the first row
reads roster, duels, welcome.

Week 4: read Insights (Professional dashboard) for which post reached the
most people, and make more like it: the next champion spotlights, the other
six raid bosses (their art is in `apps/client/src/art/raid-splash/`), and
the first short Reels from the battle captures.

### Scheduling, free

- **Meta Business Suite** (business.facebook.com, or its app): Create post →
  pick the Instagram account → add picture and caption → Schedule. Needs the
  professional account; Business Suite asks to link a Facebook Page (it can
  be a new, empty one). Posts can be scheduled up to 75 days ahead; check that the time zone
  it shows is Pacific time.
- **The Instagram app** also schedules: on the last screen before Share, open More
  options (Advanced settings in older versions) → Schedule this post.

Reply to every comment in the first hour after a post; on a new account
that does more for reach than anything else in the plan.
