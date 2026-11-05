We are continuing the UI remodel of every screen outside matches. Read first:

1. docs/ui-remodel/PLAN.md: the plan, the owner's decisions (decision 4:
   build Recent players and a Friends leaderboard in this step, with two
   read-only server endpoints and no economy or schema change), and the
   "Progress" notes for steps 1–5. Those notes say what was built, the
   choices made, what was kept for later steps, and the process changes.
2. The design: docs/ui-remodel/images/compare/ (ranks.webp, friends.webp),
   images/mockups/ (ranks-*.webp, friends-*.webp), and the mockup source in
   docs/ui-remodel/mockup/ (npx vite --config
   docs/ui-remodel/mockup/vite.config.ts, then http://localhost:4180/?s=ranks
   and ?s=friends).
3. The foundation and the patterns from steps 2–5, which step 6 must reuse:
   apps/client/src/ui/ (tokens.css, components.ts/.css, hub-panel.ts with
   openHubPanel/askConfirm and the sheet handling, patch.ts, countdown.ts),
   server-clock.ts, screens/missions* (the sheet beside a live Lobby),
   screens/raid-hall* (friends with Invite on the boss page), screens/room*,
   tests/visual/ui-measure.ts, and the specs missions, raids and rooms.
4. What step 6 replaces: progress-view.ts (ratingMarkup, ranksHelpMarkup,
   leaderboardMarkup; progressMarkup is the profile, which is step 7, so
   leave it alone), friends-hub.ts, friends-view.ts, friends.css, and the
   ratings, leaderboard and friends rules in style.css. Endpoints are in
   apps/server/src/accounts.ts (/api/leaderboard, /api/friends,
   /api/friends/request, /respond, /remove); match players are in
   arena_match_players (supabase/migrations/004 and 006).

State: steps 1–5 are on main and live. Step 5 (Raids and the rooms) ends
at commit ec9eca8.

Process (owner): no pull requests. Work on your branch, fetch and merge
main, run npm run typecheck, npm run test and npm run build, then push
straight to main (git push origin HEAD:main, fast-forward only; if main
moved, merge it and rerun the three checks). After every push to main,
confirm Render is live on that commit for both services (2D-POKEMON and
element-arena).

Another session works on the Lobby and Plaza in parallel and pushes to
main too. It changes lobby-screen.ts, lobby.css, fighter-selection.ts and
the Plaza. Friends show up in the Lobby's party, in the Plaza and in the
Farm, so fetch main often and keep changes outside your screens small and
in one place. After each merge, start lobby.spec.ts,
lobby-fighter-rig.spec.ts and missions.spec.ts in the background. Don't
wait for them before pushing; fix any failure in a follow-up push.

Now build step 6: Ranks, Leaderboard and Friends, as in the plan:
- Ranks: your rank as a tier badge with your rating, best rating, progress
  to the next rank, and the whole ladder with yours lit. The leaderboard has
  medals for the top three and your row pinned at the bottom with your rank,
  whatever your position. An Everyone / Friends switch, backed by a new
  read-only endpoint for your friends' ratings.
- Friends as a sheet: Friends · Requests · Recent tabs. Requests on top with
  Decline / Accept. Online friends first, with a status dot and one action
  (Invite to your party, Join or Watch). Offline friends say "online 2 h
  ago" (from the server's clock). Your friend code with Copy and Share.
  Recent comes from a new read-only endpoint over arena_match_players.
- The two new endpoints: read-only, no economy or schema change, with
  server unit tests. The server owns the data; the client only shows it.
- Every timer and "ago" from the server's clock.
- Delete what they replace instead of stacking: the ratings, leaderboard
  and friends rules in style.css, and friends.css. Move the tests that point
  at the old screens (check lobby, pvp-party-flow, portrait-frames,
  ui-foundation, plaza, farm and any others that open Friends or the
  leaderboard) to the new screens; what they check stays.

LAYOUT AND ALIGNMENT: THE OWNER'S TOP PRIORITY FOR THIS STEP
Earlier steps kept shipping layout mistakes that the owner had to point
out: text sitting low and to the left in a box, a button label shifted
right, art cropped while half the panel stayed empty, cards of uneven size.
Pay great attention to detail. Every panel, card, row, tag and text must be
neatly placed, evenly spaced and never overlapping, at every size.
- Text sits in the centre of its box: labels on buttons, tabs, pills, tags,
  badges, medals and the status dot. Headings and short lines centre in
  banners and empty states, and numbers line up in their column. Where text
  is meant to sit left (rows, names), it is vertically centred in its row
  and lines up with the rows above and below.
- Check centring with numbers, not by eye alone. Use inkOffset (pixels) for
  every kind of button, tab, pill, tag and medal on each screen. Use
  box-centre checks for headings and banner text: centre within 2 px. Rows
  must share left edges and heights, and grid tiles must have equal sizes
  and gaps.
- Nothing overlaps or runs out of its box: long names, big numbers (a
  rating of 9999, rank #12345), empty lists, one friend, fifty friends,
  every request state. Cut text with an ellipsis, never let it spill out.
- Panels use their room evenly: no big empty side while something else is
  cramped or cropped.

DOUBLE CHECK BEFORE YOU PUSH (required)
When the step is done, and before you push it to main, do a final review
pass:
1. Open every changed screen and state (Ranks: Everyone and Friends, your
   row in and out of the top 20, placement; Friends: each tab, with
   requests, empty, long names) at 1720×1392, 1440×900, 1280×720, 844×390
   and 852×393 with the island insets. Take screenshots and look at each
   one, zoomed in. Compare them with the mockups.
2. Run layoutProblems, closeSpot and the centring checks above on all of
   them. Run the step's own visual spec(s) and make sure they pass.
3. Fix anything off, then repeat 1–2 on what you changed.
4. Only then push. In the report, say what you checked and at which sizes,
   and attach or link the pictures.
This review covers the screens you built. The other visual suites (Lobby,
Missions and the rest) still run in the background after the push and
don't block it.

Ground rules (owner): all game text in English; the server owns time and
money; buttons in a row are equal and moderate in size; HUD boxes stay
fixed; phone landscape has no overlaps; respect the notch and Dynamic
Island safe areas; keyboard and touch; reduced motion; Low graphics.
Measure with tests/visual/ui-measure.ts at the five sizes above. The game
has sixteen fighters; don't assume eight.

Add before-and-after pictures in docs/ui-remodel/images/step6/ and the
step 6 progress notes to PLAN.md. Report plainly what was verified and what
was not, and which visual tests had passed, failed or not finished at push
time.

Lessons from steps 2–5:
- After switching branches or merging, restart the visual harness's vite
  server (tests/visual/vite.config.ts). A stale one serves an old module
  graph and the page shows "The arena couldn't load".
- Don't edit client files while a visual run is going: the dev server
  reloads the page mid-test. To merge or check during a run, use a separate
  git worktree with its own npm ci.
- ui/patch.ts rebuilds a node when its child count changes, which breaks
  focus and scroll. Keep containers always present, even when empty.
- Never run prettier on apps/client/src/main.ts: it isn't prettier-clean,
  and a reformat buries the real diff.
- When pruning CSS, drop only selectors built on classes that no source
  emits. Keep live alternatives inside :is(), give new classes names that no
  old rule uses, and compare the other screens pixel by pixel before and
  after.
- Pictures for the docs: wait for lazy images to decode and for cosmetic
  canvases to draw (a few seconds) before taking them
  (docs/ui-remodel/tools/hub-screens.cjs).
- ui-measure.ts checks a phone control's 44 px reach only while it is
  wholly in sight: scroll long lists and measure again. On phones, a
  gradient button's vertical ink offset can be off by a pixel or two; check
  dx there.
- Known slow or flaky on a CPU-only machine: champion-animation.spec.ts
  times out; farm-giants.test.ts (a 10% random check) fails occasionally;
  roster-smooth.spec.ts "the roster's fighter keeps animating" sits at the
  edge of its timing. A failure there is a timing margin, not a game bug.
