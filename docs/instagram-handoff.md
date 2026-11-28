# Instagram: handoff (28 Nov 2026)

The session that built and ran the Instagram account
(https://claude.ai/code/session_01GGURqTyss1yZEG5qcb1sBJ) paused on
Sat 28 Nov, about 8:30 AM PT. The owner is moving to another Claude
account because this one's weekly limit runs out; it resets Thu 3 Dec,
8:00 PM PT. This page is what a session on the new account needs to carry
on. The rules and how-tos are in [instagram.md](instagram.md): read that
first.

## Urgent: launch is Mon 30 Nov, 5:40 PM PT

Posting runs as a **scheduled task on the old account** ("Element Arena
Instagram", every day at 9:47 AM, 11:47 AM and 5:47 PM PT), with the Meta
token saved as a **network secret on the old account's cloud
environment**. If the old account has no usage left, those runs can fail
and nothing gets posted. So on the new account, before Mon 30 Nov 5:40 PM
PT:

1. **A cloud environment with the Meta token.** Start a session on the new
   account with this repository. Ask it to save a credential for host
   `graph.facebook.com` (request_credential, Authorization: Bearer). The
   owner pastes the token into the secure form, never into the chat. Get a
   token from developers.facebook.com → the app "Element Arena Social" →
   Instagram API → API setup with Unified login → Generate access tokens,
   as the portfolio's admin, for @elementarena.usa. The permissions come
   from the app's configuration (instagram_basic,
   instagram_content_publish, instagram_manage_comments,
   instagram_manage_insights); instagram.md, "Running the account", has the
   details and what to do if the token loses the account. A new token does
   not cancel the old one, so the old account keeps working meanwhile.
2. **Check it:** `NODE_USE_ENV_PROXY=1 node scripts/instagram/publish.mjs list`
   must list the plan and "@elementarena.usa: 0 posts". Then
   `publish.mjs check 11-home-screen` (it makes a container and never
   publishes).
3. **Create the posting scheduled task** on the new account: the prompt is
   below ("Posting task"), with a new session on each firing, push
   notifications on, at `CRON_TZ=America/Los_Angeles 52 9,11,17 * * *`
   (minute 52, so it never races the old account's minute 47).
   `publish.mjs` checks Instagram before posting and never posts an item
   twice, so the two accounts can both run until the old one is turned
   off.
4. Once the new account's task has posted something, turn the old
   account's task off (old account: scheduled task "Element Arena
   Instagram", trig_01KnrQeNbNsuY7s2u9BhbXob).

## State on 28 Nov

- **Repository:** litojace/element-arena (also litojace/2D-POKEMON).
  Everything for Instagram is on main except PR #716 (below).
- **The plan:** `scripts/instagram/plan.json`. 13 posts from Mon 30 Nov to
  Wed 16 Dec, and each post's story the next day. Approved by the owner
  (full say, 27 Nov), `paused: false`.
  - Mon 30 Nov 5:40 PM PT: welcome, duels, then the "Play it like an app"
    carousel; its 6 stories at 5:45 PM.
  - Tue 1 Dec: roster.
  - Wed 2 Dec: raid boss Lumiwick.
  - Thu 3 Dec: the Plaza.
  - Fri 4 Dec: Found a bug?
  - Sat 5 Dec: Bring your friends.
  - Then Mon/Wed/Fri: 2v2, Pyranda, skins Reel, free-for-all, the Spire.
- **Pictures:** `apps/site/social/`, served at elementarenausa.com/social/,
  where Meta fetches them. All were retaken on main on 28 Nov after that
  day's UI merges: #673 colours, #674 Settings, the new champion moves,
  #711. A preview page for the owner:
  https://claude.ai/artifact/GkhcKTBB1bN92YxiwrAimn (old account).
- **Open PR #716:** retakes of posts 10, 12 and 13 after the bare top-bar
  icons. Verify is green; it waits on issue #715 ("Main is red", a Settings
  tab test the phone-fixes session is fixing). Merge it (FAST lane) once
  #715 is closed and verify is green, before Thu 3 Dec 5:40 PM PT. If it
  conflicts, merge main into `claude/elegant-feynman-aw515e`; never rebase.
- **Not on main anyway:** the owner's raw iPhone screenshots
  (`instagram-clips/`, ignored). The how-to's scrubbed crops are committed
  in `scripts/instagram/phone/`.

## Keeping pictures current

The owner wants every picture to match the game as it is when it goes
out. On the old account a daily check ran at 1:23 PM PT; recreate it on
the new account with the prompt below ("Daily picture check"). What each
post shows and how to retake it is in instagram.md, "Keeping the pictures
current".

Coming changes that will need retakes:

- the Lobby's left rail as bare icons (phone-fixes session): post 13,
  Friends;
- "H2" paler Lobby backgrounds (UI session): post 13;
- anything that changes the battle HUD, the Plaza, Settings or the Shop's
  fitting room.

The other sessions (coordinator, UI, phone fixes, website, Plaza titles)
are on the old account. A session on the new account can't message them.
Watch main instead: `git log` on `apps/client` since the last change to
`apps/site/social`.

## Left to do

- **A missions/levels/ranks post**, aimed at Tue 15 Dec. Journey, Ranks
  and mission rewards show coin amounts, which may not go outside the game
  (the owner's rule). Pick a screen without them, or blur them as
  `screens.spec.ts` does.
- **Android how-to:** waiting for screenshots from an Android phone (the
  owner or a friend). Until then, Android's steps are in the caption only.
- **The next two weeks' plan:** due around Mon 14 Dec. The posting task
  says so when fewer than five days remain.
- **More champion spotlights:** `CHAMP=<id>` with `kit.spec.ts` captures a
  champion's skill buttons. Add a `champion` post in `make-posts.mjs` like
  Pyranda's.

## Posting task (prompt)

> You run the game Element Arena's Instagram account, @elementarena.usa, for its owner, who asked Claude sessions to post and look after comments for them (27 Nov 2026), with full say over what helps the game grow, except paid ads. Times are US Pacific (America/Los_Angeles). The owner writes Vietnamese: report to them in Vietnamese.
>
> The game is in OPEN BETA on the web (free in the browser at play.elementarenausa.com, link in bio); the iPhone and Android apps come later, with more champions, skins and features. Never give a date or promise a particular champion, skin or feature.
>
> 1. Get the repository litojace/element-arena at its latest main (`git clone --depth 1 https://github.com/litojace/element-arena`, or `git fetch origin main && git checkout -q origin/main`). Read docs/instagram.md (the open beta rules at the top, and "Running the account"): its rules bind you. Don't push anything, open pull requests, or change files in the repo in this run.
> 2. Post what is due: `NODE_USE_ENV_PROXY=1 node scripts/instagram/publish.mjs due`. The script holds the rules (approval, the pause switch, nothing twice, nothing far out of its moment). Never post anything by any other means, and never post anything not in scripts/instagram/plan.json. If it fails, run it once more; if it fails again, report the error.
> 3. Comments: `NODE_USE_ENV_PROXY=1 node scripts/instagram/publish.mjs comments` lists the comments to deal with. For each:
>    - thanks, praise, emoji, simple questions: reply briefly and warmly in the commenter's language, with `publish.mjs reply <comment-id> <text>`. Usual answers: it's an open beta, free in the browser on phone, tablet or computer, link in bio (elementarenausa.com); the iPhone and Android apps come later with more (no date); to play fullscreen like an app, add it to the home screen: the account's "Play it like an app" post shows the iPhone steps (Android: in Chrome, the ⋮ menu, then Install app).
>    - a bug report or a problem with the game: reply with a short thank-you (e.g. that it's been passed on to the team, and that in the game the gear (⚙), then Help, then Report a problem works too), and put the player's words, the post and a link in the report for the owner.
>    - spam, scams, links to other sites, insults, harassment: hide with `publish.mjs hide <comment-id>`.
>    - complaints, payments or purchases, accounts, personal data, someone who seems to be a child sharing personal details, press, business or partnership offers, anything legal or about security, or anything you're unsure of: don't reply; put it in the report for the owner.
>    Never promise dates, prizes, giveaways or features, never name or compare with another game or company, never mention money amounts.
> 4. On Sundays at the 5:52 PM run, add a week's report: `NODE_USE_ENV_PROXY=1 node scripts/instagram/publish.mjs list`, followers, and each post's likes and comments (`curl -sS "https://graph.facebook.com/v23.0/17841460513990684/media?fields=caption,like_count,comments_count,permalink,timestamp"`; the cloud's proxy adds the token), and reach (`curl -sS "https://graph.facebook.com/v23.0/17841460513990684/insights?metric=reach&period=day"`).
> 5. If fewer than five days of planned items remain after now (see `list`), say that the next two weeks' plan is due and that the owner can ask a session to make it.
>
> End with a short report in Vietnamese: what was posted (with links), comments answered or hidden, bug reports from players, and anything that needs the owner, each with what they should do. If nothing happened and nothing needs them, say so in one line.

## Daily picture check (prompt)

Run it in the session that carries this work on, every day at
`CRON_TZ=America/Los_Angeles 23 13 * * *`:

> Daily check (owner, 28 Nov: keep the Instagram pictures up to date with the game). Follow docs/instagram.md, "Keeping the pictures current", and docs/instagram-handoff.md.
>
> 1. `git fetch origin main`. List what merged since the pictures were last made: `git log $(git log -1 --format=%H origin/main -- apps/site/social)..origin/main --oneline -- apps/client packages/shared`. Pick out visible changes: Poster's palette, the battle court, HUD or effects, champion animations (the skins Reel), the fitting room, the Plaza, the Lobby, Friends, Settings, the app icon.
> 2. For each plan item not yet posted (`NODE_USE_ENV_PROXY=1 node scripts/instagram/publish.mjs list`) whose picture shows a changed part:
>    - retake it (battles.spec.ts, screens.spec.ts, report.spec.ts, skins.spec.ts with make-reel.py, kit.spec.ts, make-posts.mjs; HOWTO=1 for post 11);
>    - pick frames by eye: a big move going off, every fighter or player in sight, nothing behind a lamp post, sign or button, coin counts blurred;
>    - look at every picture, check that captions still name the right places, and copy the pictures to apps/site/social;
>    - open a FAST-lane PR (merge main into your branch, never rebase), and merge it once verify is green and no "Main is red" issue is open, so it lands before the item's time (5:40 PM PT; stories 11:40 AM or 5:45 PM).
> 3. If nothing changed, end with one line. Otherwise tell the owner in Vietnamese (PT times) what was retaken and why, with before/after pictures.
>
> Turn this scheduled task off after Thu 17 Dec, when the plan's last item has gone out, unless a new plan was added.
