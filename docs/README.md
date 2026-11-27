# Element Arena docs

One line per document, grouped by area. Back to the [README](../README.md).
Many docs record a change on the day it was made: where one disagrees with
the code on `main`, the code wins. Docs in Vietnamese are marked (vi).

## Start here

- [Player guide](player-guide.md): how every mode and screen works, the controls, raids, the Plaza and the Shop.
- [Development](development.md): running and building the game, the checks, development previews and known limits.
- [Balance notes](balance-notes.md): the history of every balance pass, newest first.
- [Removed features](removed-features.md): what the game no longer has, kept for the record.

## Champions and combat

- [Fighter assets](fighter-assets.md): how the eighteen original fighters are drawn and how sprite art can replace them.
- [Original creatures](original-creatures.md): the original creature overhaul and asset guide.
- [Animation system](animation-system.md): the creatures' animation states and art pipeline.
- [Articulated champion views](champion-side-views.md): side and rear views for the champions.
- [Creature remodel](creature-remodel.md): the original eight kits rebuilt around their real animals.
- [Eight new champions](new-champions/README.md): the design handoff for the second eight, and the 2v2 and free-for-all tuning.
- [Nature champions](nature-champions.md): Pangrove and Mossloth, the ninth element.
- [Every kit its own](unique-kits.md): skills that copied another champion's, made unique.
- [Skill revolution](skill-revolution.md): skills that did too little, replaced.
- [Champion balance overhaul](balance-overhaul.md): the November 2026 balance brief and changes.
- [Skills while holding Basic](held-basic-skills.md): casting skills while Basic repeats.
- [Attacks and stone cover](projectile-cover-fix.md): two fixed bugs with cover near corners.
- [Smarter bots](smarter-bots.md): how Easy, Normal and Hard bots play.

## PvP, rooms and friends

- [PvP audit and plan](pvp-plan.md): the 19 Nov 2026 plan that made the game PvP-first.
- [Private-room invitations and knockout flow](pvp-party-flow.md): inviting friends and what a knocked-out player sees.
- [Hidden picks](hidden-picks.md): fighter picks kept hidden until the match.
- [Live PvP motion](pvp-live-motion.md): keeping fighters moving smoothly through strong hits.
- [Match history](match-history.md): your matches on your player card.
- [The rank road](rank-road.md): the ranks players climb and what each tier gives.
- [In-game chat](chat-plan.md): the approved chat plan.
- [One connection per account](account-sessions.md): which game connection owns an account's seat.

## Raids and the Spire

- [Boss Raid](boss-raid.md): the raid guide and its deployment setup.
- [Raid roster, Shop and missions design](raid-roster-design.md): the approved design for the seven bosses.
- [Ordinary raids](regular-raids.md): ordinary raids and the compact battle HUD.
- [Boss identity refresh](boss-identity-refresh.md): the bosses' new names on their old ids.
- [Raid boss splash art](raid-boss-splash.md): the seven boss posters.
- [Raid arenas](raid-arena-style.md): floors matched to the boss posters.
- [Drawing a boss's face](boss-face-drawing.md): a recipe with templates.
- [Raid layout](raid-layout.md): rite cards and arena visibility on phones.
- [Full-viewport raids](raid-viewport.md): the raid camera.
- [Raid HUD and safe areas](raid-safe-areas.md): the HUD clear of the phone's notch and home bar.
- [Mobile Raid Hall](mobile-raid-layout.md): the boss list on a landscape phone.
- [Mobile controls and raid briefings](mobile-input-and-raid-guides.md): recoverable touch controls and clearer briefings.
- [Updating the Spire](spire-content-guide.md): adding Spire zones, floors and bosses.

## Hub, Plaza and progression

- [Onboarding](onboarding.md): the Lobby tour and How to play.
- [Player journey and weekly arcade](adventure-roadmap.md): levels, the seasonal journey and the arcade.
- [Plaza rewards](plaza-economy.md): the Plaza's daily quests and gift boxes.
- [Mission audit](mission-audit.md): every daily mission checked end to end.
- [New player funnel](player-funnel.md): how many new accounts play and come back.
- [Hub redesign](hub-redesign/README.md): the Lobby and Plaza design handoff (its Farm parts are removed).
- [Hub redesign plan](hub-redesign/PLAN.md) and [tuning numbers](hub-redesign/NUMBERS.md): how the handoff was built (the Farm numbers are history).

## Shop and cosmetics

- [New Shop skins and items](shop-new-items.md): the skins and items added from 25 Nov 2026.
- [Fashion collections](fashion-collections.md): the Rare and Epic fashion collections.
- [Portrait frames](portrait-frames.md): equipped circular player portraits.
- [Avatar prompts](avatar-prompts.md): briefs for the next library avatars.
- [Avatar photo storage](avatar-photo-storage.md): players' own pictures in Supabase Storage.
- [Coin economy review](economy-review.md) (vi): Shop coin measurements and proposals.
- [In-app purchase research](iap-research.md) (vi): selling coin packs through Apple, research only.

## Look, art and sound

- [The game's look: Poster](ui-themes.md): the one look every player has.
- [UI remodel plan](ui-remodel/PLAN.md): the 3 Nov 2026 remodel of every screen outside matches (an earlier look).
- [One glass look](ui-remodel/MOBILE-GLASS.md): the 16 Nov 2026 phone pass (an earlier look, before Poster).
- [Loading screens](loading-screens.md): the startup curtain.
- [Loading art prompts](loading-art-prompts.md): briefs for the loading paintings.
- [Login background study](login-background-study.md): art direction for the login.
- [World art perspective](world-art-perspective.md): the shared camera angle for world art.
- [Retina rendering](retina-rendering.md): sharp fighters and nameplates.
- [Music](music.md): the soundtrack.

## Phones and the app

- [Mobile controls and PWA](mobile-pwa.md): touch controls and installing the game as an app.
- [Mobile combat controls](mobile-combat-layout.md): the mobile battle layout.
- [Mobile court foreground](mobile-court-foreground.md): what shows below the court on a phone.
- [Desktop arena space](desktop-arena-layout.md): the court on a desktop screen.
- [The iOS app](ios-app.md): the iPhone and iPad version.
- [App Store screenshots](app-store-screenshots.md): rendering the store screenshots.

## Performance

- [Networking and battle performance](network-performance.md): the protocol, the budgets and measurements.
- [Battle performance audit, 23 Nov 2026](battle-performance-audit-2026-11-23.md) (vi).
- [Battle input clock, session 1](battle-input-clock-session-1.md) (vi).
- [Battle effects on slow iPhones, session 2](battle-gpu-session-2.md) (vi).
- [Battle input and hit timing, session 3](battle-input-hit-session-3.md) (vi).
- [Performance sweep, 25 Nov 2026](performance-sweep-2026-11-25.md) (vi).

## Servers, accounts and operations

- [Account setup](accounts-setup.md): the game's Supabase project and sign-in.
- [Automatic production migrations](auto-migrations.md): how a migration reaches the live database.
- [Server updates](server-updates.md): deploying without kicking players out of matches.
- [Static frontend](static-frontend.md): how Render serves the game, and its security headers.
- [Moving to play.elementarenausa.com](domain-move.md): the game's address change.
- [Website](website.md): the elementarenausa.com site (`apps/site`).
- [Website accounts](website-accounts.md): accounts and one-tap Play on the website.
- [Dependency audit](dependency-audit.md): dependency warnings and updates.
