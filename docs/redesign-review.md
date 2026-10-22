# Visual redesign review

Implementation follows [redesign-plan.md](redesign-plan.md). Only client presentation and documentation change; gameplay and server contracts stay unchanged.

## Phase 1 — tokens and base components

- Added the specified navy, text, accent, danger, radius, easing and element tokens. Preserved `--muted`, `--lime` and `--stadium-red` as aliases.
- Replaced exact matching CSS colors with tokens. Kept alpha variants and fighter palettes intact.
- Added primary/secondary buttons, cards, pills and uppercase section titles without removing existing selectors. Press feedback respects reduced motion.
- Bundled the existing Barlow Condensed and DM Sans typefaces locally, with their licenses, without depending on an external font request.
- Typecheck passed. All 854 tests passed. `npm run dev` reviewed at 1280×720 and 844×390: no horizontal overflow or JavaScript errors.
- `npm run format:check` was run. It was already failing in 81 files before this work; it now reports 78 unchanged files. All files changed in this phase pass Prettier. Formatting server/shared/test files is outside the authorized scope. Two CSS blocks retain their source formatting with `prettier-ignore` because existing regression tests query their literal formatting.

## Phase 2 — home scene

- Replaced the home screen with a full-height navy scene, a large front-facing fighter using the existing artwork, an element-colored glow, uppercase fighter name and actual mastery tier. The last picked fighter is remembered locally.
- Added the left navigation rail, gold active marker, compact daily-mission badge, thin account/avatar/level/currency header, direct settings shortcut, season progress and a bottom-right mode picker with a single gold PLAY action.
- Kept every existing literal element ID. The original fighter selection remains reachable in its own panel; joining, spectating, AI difficulty, bot battles and solo testing remain in Play options. Existing lobby markup and network actions are reused.
- Added focus containment and Escape/close behavior for the home panels, keyboard mode navigation, and home controller focus/confirm/back/settings navigation. The UI controller loop stops outside home and never changes battle inputs.
- Reserved safe areas, collapsed the phone rail to icons, constrained the artwork to avoid overlapping controls, kept featured artwork mounted during wallet/XP refreshes, and honored reduced motion.
- Included the original local font files in the PWA static precache; the installed app uses the new navy theme color.
- Typecheck and all 854 tests passed. The client production build and PWA verification passed. Browser review at 1280×720, 844×390 and 568×320 covered all eight fighter selections, every mode, feature entry points, panel focus, controller confirm/navigation, reduced motion, simulated safe areas, portrait rotation gate and returning from the existing duel/team/FFA lobbies. No page errors or horizontal overflow were found.
- `npm run format:check` still reports 76 pre-existing failures in untouched files; the original baseline was 81. All client/documentation files changed by this redesign pass Prettier. Protected files and the repository's formatting command/ignore rules were not changed.

Review screenshots use an in-browser sample profile because no Supabase credentials are available in this environment. No fixture or authentication bypass is shipped:

- [Desktop home, 1280×720](redesign-phase2-desktop.png)
- [Landscape phone home, 844×390](redesign-phase2-mobile.png)

Stopped after Phase 2 for review. Phases 3–8 are not included.

## Phase 2 review fix — layout and readability

The first review missed the fixed 150px fighter-name override at the wide-screen breakpoint. Names could break mid-word, while supporting labels were only 8–10px.

- Replaced the home scene's viewport offsets with content rows that reserve space for the heading, fighter and bottom controls. The central fighter group has a bounded width and height on large and tall desktops.
- Sized fighter names from their own text column and kept them on one line. Removed the 1600px font-size jump.
- Increased desktop role text to 16px, mastery details and secondary actions to 14px, and season/mode labels to 12–13px. Improved contrast for decorative labels too. Phone secondary text is now 11–12px rather than 7–9px.
- Preserved right/left/bottom safe areas, reduced motion, controller/keyboard navigation and every existing selector. No gameplay or networking changes.
- Browser checks cover all eight fighters at 1024×768, 1280×720, 1280×1024, 1366×768, 1440×900, 1599×900, 1600×900, 1600×1200, 1680×1050, 1920×1080, 2560×1440, 844×390 and 568×320. Names fit their columns; the page does not overflow. Separate interaction checks cover mode switching, safe areas, controller input, reduced motion and returning from lobbies.
- Typecheck, all 854 tests, the production client build and PWA verification pass. The existing repository-wide formatting failures remain in untouched files; changed files pass Prettier.

Updated previews: [desktop](redesign-phase2-desktop.png), [tall desktop](redesign-desktop-tall.png), [landscape phone](redesign-phase2-mobile.png). Review profiles remain browser-only fixtures.

## Phase 3 — fighter selection and lobby

- Rebuilt selection as element-tinted portrait cards beside an independently scrollable, larger fighter preview. Cards keep equipped skins, range labels, HP, skill icons and the existing mastery badge; a portrait ring now shows progress between the existing mastery milestones.
- Selecting a fighter updates the preview in place with a short slide and updates the lobby's element tint. Reduced motion skips the slide and decorative animation. The page stays still and card positions remain stable.
- Moved room information, players, team selection, raid difficulty and party rules into a scrollable side card. Ready is the gold primary action; Ready, Leave, spectator exit and raid reward shortcuts stay outside the scrolling information.
- Extended menu controller navigation to the lobby and added right-stick scrolling for the focused roster, preview or room information. Existing native keyboard controls and battle controller inputs are unchanged.
- Reviewed all eight selections and duel, teams, FFA and raid lobbies at 1280×720, 1920×1080, 844×390 and 568×320. Verified viewport fit, pinned actions, reduced motion, simulated phone safe areas and controller scrolling. Very narrow landscape screens let the selection region scroll to the preview below the cards.
- Typecheck and all 854 tests passed. The repository-wide formatting check still reports the same 76 pre-existing failures in untouched files; changed files pass Prettier.

Browser-only sample accounts remain confined to the review harness. Previews: [desktop lobby](redesign-phase3-desktop.png), [landscape phone raid lobby](redesign-phase3-mobile.png), [desktop skill details](redesign-phase3-skills.png).

Phase 3 desktop review: tightened portrait spacing, fixed explicit navigation/selection rows, and split the selected preview into Overview and Skills & combo sections with sticky native buttons. The active section stays selected when comparing fighters. Wide previews place the portrait beside the information instead of stacking both into a long column.

## Phase 4 — match HUD and combat feedback

- Anchored compact PvP health/name/score cards inside the court corners, with element-colored health fills and an ultimate charge meter beside the HP text. Team colors and all existing HUD IDs remain intact. The ultimate meter has an accessible name and current value.
- Restyled desktop skills as circles and added radial cooldown sweeps with seconds. Touch controls use matching rings without changing their positions, hit areas, cooldowns, bindings or input behavior. Rings resolve the registered cooldown property on the control before inheriting it into their visual layer.
- Kept the existing heavy-hit pauses, shake, haptics and KO slow-motion values. Added bold, outlined damage/heal numbers and a gold KO wash capped at 12% opacity using the existing KO duration. Reduced motion skips the new wash and number movement as well as the existing camera shake/zoom and hit stop. Displayed fractional amounts are limited to one decimal; actual combat amounts are unchanged.
- Fixed an arena sizing feedback problem: the canvas now follows the frame's dimensions, so its previous pixel height cannot enlarge the frame into the HUD or skill bar. Desktop PvP now fits the full court instead of following and zooming toward one fighter; the HUD and skills share that larger court frame. Landscape phones reserve the measured HUD/callout height, including wrapped statuses, rather than assuming a fixed height. Increased desktop control hints and roster selection labels for readability.
- Reviewed duel, teams, FFA and raid snapshots at 1280×720, 1920×1080, 844×390 and 568×320. Additional checks at 1024×600 and 1600×1200 use long player names, three simultaneous statuses, full ultimate meters and phone safe-area insets. Checks compare text/card bounds, center labels against player cards, and the arena against phone HUD/callouts, plus desktop HUD/skill bounds inside the court. Existing raid controls and boss HUD remain in place.
- Checked rendered cooldown ring values, critical-hit label size/color, compact healing amounts and KO effects. Separate reduced-motion browser checks verify stationary numbers, no KO wash/zoom/hit stop, safe touch controls and the portrait rotation gate. The home readability regression still passes for all eight fighters across 13 viewport sizes.
- Typecheck, all 854 tests, the client production build and PWA verification pass. The full formatting check still reports 76 pre-existing failures in untouched files; all changed files pass Prettier. No server, shared package, database, socket shape, gameplay number, hitbox or gameplay timing changed.

Review snapshots are generated from the existing simulation and supplied only by an external browser harness; no fixture or authentication bypass ships in the client. Previews: [desktop match HUD](redesign-phase4-desktop.png), [landscape phone team HUD](redesign-phase4-mobile.png).

Stopped after Phase 4. Results, shop/dialog redesign and later phases remain for a separate review.

## Desktop review — arena space and fighter details

- Removed the desktop battle width cap and inherited viewport-wide side padding. The court grows to the available width or height while keeping its proportions, HUD anchors and input mapping. At 2234×1274, the practice court grows from approximately 1377px to 2053px wide.
- Moved desktop Practice settings into a compact bottom-left control. Its scrollable popover keeps every setting and exit action reachable without reserving a row above the arena or resizing it when opened.
- Aligned roster cards into consistent name, element, role, portrait, skills and footer rows. HP and selection have dedicated labels; changing selection no longer overwrites a mastery badge or leaves another card displaying “Selected.” Earned mastery badges retain their own row.
- Desktop previews show the overview followed immediately by all four skills and the combo. Compact screens retain the section buttons; resizing between layouts preserves the selected section and keeps both desktop sections visible.
- Typecheck, all 854 tests, the production client build and PWA verification pass. Changed files pass Prettier; the full formatting check still reports the same 76 pre-existing failures in untouched files.
- Browser review covers practice, duel, teams and raids at 2234×1274, 1920×1080, 1280×720, 1024×600, 2560×1080 and 844×390. Checks cover maximized desktop court bounds, unchanged arena size when Practice opens, card alignment, repeated selection, desktop/phone preview switching and viewport overflow. Additional lobby checks use mixed earned mastery tiers and verify pinned actions, controller scrolling and safe areas.

Updated previews: [expanded desktop arena](redesign-arena-expanded.png), [desktop overview and skills](redesign-roster-aligned.png). Review data remains confined to the external browser harness. This is a follow-up to Phases 3–4; later phases are unchanged.

## Home review — full fighter silhouette

Cindrake's tall crest extends beyond the default full-body SVG crop after the chibi proportions and idle animation are applied. Scaling the same cropped SVG down would leave the flame cut off.

- Gave home portraits a separate, padded SVG frame. Fighters appear slightly smaller, with space above crests and around animated extremities. Avatar crops, roster previews and in-match textures remain unchanged.
- Checked all eight fighters at seven idle-animation positions across 13 desktop and landscape-phone sizes, including 1280×720 and 844×390. Their silhouettes remain within the padded frame; the scene and controls fit without page overflow. Reduced-motion artwork remains stationary.
- Typecheck, all 854 tests, the production client build and PWA verification pass. Changed files pass Prettier; the full formatting check retains the 76 existing failures in untouched files.

Preview: [complete home fighter portrait](redesign-home-full-fighter.png).

## Roster controls and desktop battle clicks

- Hid the redundant roster arrow controls and removed their header column. Existing selectors remain intact; mouse-wheel, touch, keyboard focus and controller scrolling still reach every fighter.
- Disabled native mouse text selection during desktop battles to prevent HUD and control labels being highlighted by rapid clicks or drags. Inputs, text areas and editable fields remain selectable; clipboard buttons and gameplay input handlers are unchanged.
- Typecheck, all 854 tests, the client production build and PWA verification pass. Changed files pass Prettier; the full formatting check retains the same 76 existing failures in untouched files. Browser checks cover the roster at 1280×720 and 844×390 and desktop battle text selection, with editable-field checks.

## Charged ultimate presentation

- Added a warm gold core, element-colored orbiting energy ring, inner halo and brighter icon to fully charged ultimate controls. Button dimensions and hit areas stay fixed; the HUD meter gains a matching glow.
- Touch controls now display a readable READY label and expose the ready state in their accessible name. Spending the charge removes the effect immediately, including when used during the old arrival-burst interval. Reduced motion retains the gold ready appearance without animation.
- Browser checks at 1280×720, 844×390 and 568×320 cover 99% → ready → spent, repeated snapshots without restarting the ring, stable button bounds, icon/label separation and reduced motion. Typecheck, all 854 tests, the client build and PWA verification pass; the unchanged formatting baseline remains 76 files.

## Mobile avatar roster and lobby space

- Replaced large phone roster portraits with compact, still head-and-shoulders avatars, a name/element/role summary, all four skill icons and cooldowns, HP, selection status and mastery. The selected fighter's detail panel uses a small avatar so its introduction and properties have more room. Overview and skill details remain reachable through the existing section buttons. Desktop keeps the full portrait grid; resizing restores the original full-body SVG frames.
- Fixed late-loading mastery records: every mounted card now refreshes its ring and badge as soon as records arrive, rather than waiting for selection. Unchanged records keep their existing nodes; updates preserve artwork, card positions and scrolling.
- Reduced the phone lobby heading to a single 20px line and tightened the roster drawer header. Private-lobby copy/code controls and introductions use less vertical space. Ready and Leave share one pinned row; raid actions retain their existing separate layout.
- Reviewed all eight fighters and duel, teams, FFA and raid lobbies at 1280×720, 1920×1080, 844×390 and 568×320. Additional phone checks verify text/panel bounds with 44px side and 21px bottom safe areas, stationary avatars, section switching, touch swipes, mouse-wheel scrolling and controller/keyboard navigation. Standard landscape phones keep details on the right; very narrow lobby windows retain the existing scrollable stacked fallback.
- Verified late records without a tap, mastery reset, retained art/scroll, repeated updates without replacing nodes, and desktop ↔ phone portrait restoration. Typecheck, all 854 tests, the client production build and PWA verification pass. Changed files pass Prettier; the full formatting check retains the same 76 pre-existing failures in untouched files.

Updated previews: [compact mobile roster](redesign-mobile-avatars.png), [mobile private lobby](redesign-mobile-lobby.png). Sample records remain confined to the external review harness.

## Fighter selection — all eight cards visible

This replaces the taller mobile cards and stacked narrow-phone fallback above.

- Kept all eight fighters visible in a two-column, four-row grid on the left. Each compact card contains a still avatar, name, element and mastery ring; the selected card has a gold border. Large card portraits, repeated cooldown rows and HP now give way to the selected fighter's information on the right.
- Restored a full animated fighter in the right pane, with a padded frame for tall crests. Overview, mastery, properties, basic attack, all four special skills, combo and shared dash/jump instructions appear together. Only this detail pane needs to scroll; reduced motion keeps the artwork still.
- Kept the private room beside the fighter panels on standard landscape phones and desktops. Below 741px, a native “Room & ready” disclosure gives both fighter panels enough width. Room information scrolls independently of its pinned actions; touch, keyboard and controller can open it. Escape and outside taps close it, and resizing restores the normal room panel.
- Browser checks cover all eight selections and duel, teams, FFA and raid rooms at 1280×720, 1920×1080, 844×390 and 568×320. Checks verify all card bounds without roster scrolling, right-hand details, stationary card artwork, animated full previews, reduced motion and phone safe areas. Additional checks cover keyboard/controller activation, touch dismissal, pinned actions, repeated resizing, text bounds and scrolling through the combo and shared controls.
- Typecheck, all 854 tests, the client production build and PWA verification pass. Changed files pass Prettier; the repository-wide formatting check retains the same 76 pre-existing failures in untouched files. No gameplay, server, shared package or database changes.

Updated previews: [desktop fighter grid](redesign-roster-compact.png), [landscape phone fighter grid](redesign-mobile-avatars.png), [landscape phone private lobby](redesign-mobile-lobby.png). Review fixtures remain outside the shipped client.

## Home review — softer ground and elemental effects

- Replaced the outlined platform and duplicated hard shadow with a feathered contact shadow and a faint element-colored pool of light, drawn in the fighter SVG so they remain aligned with its feet at every viewport size. Image-based art retains a soft fallback. The existing padded portrait frame keeps tall crests visible.
- Restored the existing elemental trait effects around the featured fighter: sparks, embers, bubbles, floating crystals, light particles, psychic orbs, leaves/rocks and wisps. Home uses quieter opacity and omits repeated floor rings and Cindrake's flat-bottomed flame wall. Equipped skin artwork and cosmetic attributes remain intact; these are the existing menu effects, without an additional canvas or renderer.
- Extended the menu motion observer to pause SVG clocks for reduced motion and pause background artwork when a home drawer makes the scene inert. CSS animations and SVG motion resume on the same nodes when appropriate. Hidden tabs, covered menus and offscreen portraits retain their existing pause behavior.
- Reviewed every fighter at 1280×720, 1920×1080, 844×390 and 568×320, sampling seven character-animation positions for crest/silhouette bounds. Also checked safe areas, equipped stage-three artwork, dynamic reduced-motion changes, paused SVG clocks and reopening/closing fighter selection. The ground has no outline and the page stays within the viewport.
- Typecheck, all 854 tests, the client production build and PWA verification pass. Changed files pass Prettier; the repository-wide formatting check retains the same 76 pre-existing failures in untouched files. Only client presentation and review documentation changed.

Previews: [Cindrake with embers and soft ground light](redesign-home-ground.png), [landscape-phone elemental effects](redesign-home-effects-mobile.png).

## Home review — match the Shop's fighter poses

- Home now uses the Shop's shared animation rig for the featured fighter, with the same idle pose inputs, skin stages and skin effects. Auralynx settles into her floating meditation pose with tucked feet and a continuously rotating ring; the other seven fighters use their own signature idle movements. No rig or battle behavior changed.
- Kept the padded home framing, soft contact shadow, element glow and surrounding trait effects. The original SVG stays as an accessible loading/failure fallback; its character and scarf disappear only after a fully posed canvas frame is ready. The Shop's outlined floor does not appear on home.
- Reuses one silent 30fps preview while comparing fighters, with only front-facing textures and the existing bounded eight-look cache. It pauses when drawers, Shop or other menus cover home, and while offscreen or in a hidden tab. Entering battle or leaving home disposes the preview. Reduced motion renders one stationary frame, then sleeps.
- Browser review covers all eight fighters at 1280×720, 1920×1080, 844×390 and 568×320, including Auralynx's floating pose, stable framing and phone safe areas. Additional checks cover rapid switching, all eight stage-three Mythical skins, a collection aura, the actual Shop renderer and original comparison, drawer pause/resume, reduced motion, disposal/recreation and a blocked-renderer fallback. Review hooks stay in the external browser harness.
- Typecheck, all 854 tests, the client production build and PWA verification pass. Changed files pass Prettier. Formatting the touched preview-layout file reduces the repository's existing formatting failures from 76 to 75; the remaining files are untouched.

Previews: [Auralynx floating on home](redesign-home-shop-pose.png), [landscape-phone Shop-style idle](redesign-home-shop-pose-mobile.png).

## Roster review — use the available card space

- Replaced the fixed tiny thumbnail/type sizes with sizing based on each tile's own width and height. At 1280×720, home avatars grow from 48px to approximately 76px and names from 20px to approximately 31px. At 844×390, home avatars grow from 24px to approximately 43px and names from 15px to approximately 20px. Larger desktop tiles allow 112px avatars and 32px names.
- Centered avatar and text groups on the same vertical axis, scaled the mastery ring with the avatar, enlarged element labels, and kept consistent padding/gaps. Portraits stay inside their intended avatar crop. Narrow room cards adapt separately rather than forcing tiny sizing onto every phone card.
- Kept all eight fighters visible without roster scrolling, with the selected details on the right and every room action reachable. Browser checks cover all eight selections and duel, teams, FFA and raid rooms. Additional spacing checks cover nine desktop/landscape sizes, the screenshot's short desktop proportions, phone safe areas, avatar/text center alignment, every card's text/pill bounds and absence of overlap.
- Added the user's standing UI requirement to the redesign plan: review spacing, alignment, visual balance, readable sizing, long names and selection states on desktop and landscape phones before finishing any UI change.
- Typecheck, all 854 tests, the client build and PWA verification pass. Changed files pass Prettier; the repository-wide formatting check still reports 75 pre-existing failures in untouched files.

Updated previews: [larger desktop avatars and names](redesign-roster-compact.png), [landscape phone roster](redesign-mobile-avatars.png), [private lobby](redesign-mobile-lobby.png).

## Fighter selection review — share the Shop/Home animations

- The selected fighter's right-hand portrait now uses the same rig, idle poses, equipped skin stages and ambient skin effects as Shop and Home. Auralynx floats with tucked feet and a rotating ring; the eight left-hand avatar cards stay stationary.
- Extended the existing preview controller to move one renderer between Home and the visible selection panel. Repeated choices reuse front-facing textures and the bounded eight-look cache. Live cosmetic metadata updates the preview without rebuilding the surrounding information. Shop's independent item preview keeps its existing behavior.
- Shared the soft ground treatment with the full selection portrait, and kept the quieter elemental effects around it. The canvas occupies exactly the SVG's first grid row, leaving the caption in its own row. Portrait dimensions, stats, skills, combo, card sizes and room actions retain their existing positions. Original SVG/image artwork remains the loading/failure fallback.
- Browser review checks every fighter in Home selection and duel, teams, FFA and raid lobbies at 1280×720, 1920×1080, 844×390 and 568×320. Checks cover canvas/SVG bounds, caption separation, still avatars, all eight cards without scrolling, safe areas and Ready/Leave access. Additional checks cover all eight stage-three Mythical skins, live aura changes, rapid choices, controller scrolling, offscreen sleep, dialog/room-popover pauses, reduced motion, renderer cleanup on battle entry and a blocked-renderer fallback. Review hooks are external to the shipped client.
- Typecheck, all 854 tests, the client production build and PWA verification pass. Changed files pass Prettier; the full formatting check retains 75 existing failures in untouched files. No server, shared package, database, networking or gameplay changes.

Updated previews: [desktop animated fighter details](redesign-roster-compact.png), [landscape-phone fighter details](redesign-mobile-avatars.png), [private lobby](redesign-mobile-lobby.png).

## Fighter selection review — give information more width

- Narrowed the two-column fighter grid to approximately 36% of the selection area, with width limits that keep all eight avatar/name cards readable and visible. The detail panel grows from approximately 546px to 746px at 1280×720; at 1920×1080 the roster is capped at 460px so the information can use the extra width.
- Wider detail panels show skills in a two-column grid, with aligned key labels, icons, descriptions and cooldowns. Tightened overview spacing and portrait height in these panels. Stats use columns that can shrink safely and descriptions wrap within their pane; all existing text, skills, combo and shared-control instructions remain reachable.
- Landscape phones use a smaller bounded roster and a wider detail pane. Where the pane has enough width, the portrait sits beside the entire introduction/properties group. At 844×390, the home detail pane grows from roughly 360px to 483px; the private-lobby pane grows from roughly 272px to 517px. Very narrow phones retain the stacked information layout inside the right pane.
- Extended the existing “Room & ready” disclosure to all compact landscape layouts up to 1000px, freeing the width previously reserved for a third column. The pop-up keeps room information scrollable and its actions pinned. Desktop retains the room sidebar; resizing, keyboard, controller and touch keep every control reachable.
- Reviewed card contents, avatar/name alignment and safe areas at nine desktop/landscape sizes. Additional browser checks cover all eight animated selections and duel, teams, FFA and raid rooms at 1280×720, 1920×1080, 844×390 and 568×320, plus skill icon/text bounds, caption/canvas alignment, all Mythical stage-three skins, rapid selection, room controls, controller scrolling and reduced motion.
- Typecheck, all 854 tests, client build and PWA verification pass. Changed files pass Prettier; the full formatting check retains the 75 pre-existing failures in untouched files. Only client presentation and review documentation changed.

Updated previews: [wider desktop information panel](redesign-roster-compact.png), [landscape phone selection](redesign-mobile-avatars.png), [landscape private lobby](redesign-mobile-lobby.png).

## Fighter selection review — stable selection outline

- The compact roster inherited a 250ms border/shadow transition from the old showcase cards. Changing fighters immediately updated the selected state but left the previous card's gold border fading out, briefly showing two highlighted fighters. Compact cards now change their border and shadow immediately.
- Kept the gold selection stroke inside each card. Keyboard focus uses a separate inset light outline, keeping focus visible even along the clipped edges of the four-row grid. Card sizes, avatar/text spacing, details, selection events and animations in the right-hand preview are unchanged.
- Browser checks cover every fighter, rapid switching, mouse/touch and keyboard activation, Home and private duel/team rooms, normal/reduced motion, desktop and landscape-phone sizes with safe areas. Each sampled frame contains exactly one gold selection border, with no card movement or roster scrolling.
- Typecheck and all 866 tests pass. Updated files pass Prettier; the full formatting check continues to report 73 pre-existing failures outside this change.

## Raid rite selection and header currency

- Rebuilt the rite-choice presentation as a screen-sized navy window with three equal, centred cards. Larger illustrations, coloured edges, clear titles and aligned description tracks make each option easier to scan. Desktop cards are roughly 370px tall at 1280×720; a landscape phone at 844×390 gets 168px cards without scrolling the choices.
- Moved the live countdown beneath the choices and centred it at every reviewed size. Phase guidance and optional team builds remain reachable in their own compact scroll region, which does not move the cards or timer when opened. Countdown updates preserve the buttons and focus; the existing 15-second allowance and urgency threshold are unchanged.
- Short landscape layouts place icons beside titles. All twelve rites fit at seven sizes, from 568×320 through 1920×1080, with phone safe areas. Lucid has a shorter equivalent description in the card; the original wording is retained in its tooltip. Hover/focus styling respects reduced motion.
- Fixed the existing keyboard/controller selection lookup to use raid offers during raids and ordinary rite offers during PvP. Selection still sends the same request and payload; gameplay and server rules are unchanged.
- Reduced only the header coin pill: 16px balance text on desktop and 15px on compact screens, with smaller padding and icons. The button retains a 44px touch target. Checked ordinary, large and unlimited balances alongside the other header controls.
- Browser checks cover all bosses and chapters, locked-in/waiting state, stable countdown nodes, keyboard activation, mapped controller actions, native team-detail scrolling, focus, reduced motion and header alignment. Typecheck, all 866 tests, the client build and PWA verification pass. Updated text/code files pass Prettier; the full check retains existing formatting failures elsewhere.

Previews: [desktop rite choices](redesign-raid-rites-desktop.png), [landscape phone choices](redesign-raid-rites-mobile.png), [smaller header coin display](redesign-header-coins.png).
