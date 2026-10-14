# Separate game accounts

Element Arena follows AMATYC's Supabase auth pattern: email/password signup and login, email confirmation, Google sign-in, password recovery, and optional remembered sessions. Create a **new Supabase project for the game**. Its accounts remain separate from AMATYC. No administrator or default password is shipped.

## Database

In the new project's Supabase SQL Editor, run [001_arena_accounts.sql](../supabase/migrations/001_arena_accounts.sql). It creates profiles, admin membership, title definitions/ownership, and an admin audit log. Then run [002_admin_cleanup_reports.sql](../supabase/migrations/002_admin_cleanup_reports.sql), which adds problem reports and the admin suspend/delete functions. Then run [003_titles.sql](../supabase/migrations/003_titles.sql), which records when titles were created (newest custom titles list first) and lets admins delete titles. Then run [004_matches_achievements.sql](../supabase/migrations/004_matches_achievements.sql), which adds match history, head-to-head records, achievements (each grants a title of the same name), monthly season standings and fighter mastery, and marks guest logins. Then run [005_friends.sql](../supabase/migrations/005_friends.sql), which adds friends: requests by 8-character friend code (or from a match result), accept/decline and remove. The game server adds who's online, their room and a Join/Watch button. Profiles are created when users first log into the game. User-controlled signup metadata cannot grant admin rights. Passwords remain in Supabase Auth.

Ordinary clients cannot read/write these tables directly. Authenticated RPCs check identity, admin membership, suspension and title ownership. The migration does not modify AMATYC tables.

## Environment settings

Find the project URL and public anon/publishable key in Supabase settings. Add these values to root `.env` for local server development:

```dotenv
SUPABASE_URL=https://YOUR_GAME_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_GAME_PUBLIC_ANON_KEY
```

Add the public settings to `apps/client/.env.local` for Vite:

```dotenv
VITE_SUPABASE_URL=https://YOUR_GAME_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_GAME_PUBLIC_ANON_KEY
```

In Render Environment, set **all four** settings above, plus:

```dotenv
VITE_SITE_URL=https://parena.litojace.com
```

Restart local development after changing env files. Redeploy Render after changing public settings because `VITE_` values are bundled at build time. The Blueprint prompts for these values without committing them. The app uses the public key and a user's token; **no service-role key is required or permitted in browser settings**. Missing configuration keeps gameplay locked rather than creating fake accounts.

## Email confirmation and recovery

Enable email/password in Supabase Authentication and keep email confirmation enabled for public signup. Configure email delivery and auth abuse/rate limits before public launch.

Supabase's default email sender only delivers to addresses belonging to your project's team. Use your Supabase team email for the first administrator test. Before inviting other players, configure a custom SMTP provider under Authentication's email/SMTP settings. See [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

Under Authentication → URL Configuration, set Site URL to `https://parena.litojace.com` and allow:

```text
https://parena.litojace.com/email-confirmed
https://parena.litojace.com/auth/callback
https://parena.litojace.com/reset-password
http://localhost:5173/email-confirmed
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
```

Add matching localhost:3001 URLs for local production testing. Leave `VITE_SITE_URL` unset during same-device local development. Email links must point to an address accessible from the device opening the email.

## Your administrator account

Sign up with your intended email, confirm it and log in once. In Supabase's trusted SQL Editor run, replacing the sample email:

```sql
insert into public.arena_admins(user_id)
select id from auth.users
where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com')
  and email_confirmed_at is not null
on conflict do nothing;
```

Verify the intended membership:

```sql
select u.id, u.email
from public.arena_admins a join auth.users u on u.id = a.user_id;
```

Refresh the game. **Admin** appears in navigation. **Solo test mode** is available to every signed-in player. Admin membership grants/revocations are done only through trusted SQL administration. The web dashboard cannot promote players or suspend administrators, preventing accidental self-lockout.

## Google sign-in

Optionally enable Google in Supabase using a Google OAuth web client. Register the exact callback supplied by Supabase (normally `https://YOUR_GAME_PROJECT.supabase.co/auth/v1/callback`) as Google's authorized redirect URI. Add the game origin as an authorized JavaScript origin. Keep the Google secret in Supabase, not the repository. See [Supabase's Google guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Player and title management

**Admin → Players & titles** supports searching/pagination, renaming players, suspending/reactivating ordinary players, creating/editing/retiring titles, and granting/revoking title ownership. Updates are recorded in `arena_admin_audit` for trusted database inspection. Players open their name in navigation to equip one of their granted, active titles. Equipped titles appear above their creatures. Retired and revoked titles cannot be equipped.

Solo testing checks authenticated, unsuspended accounts on every command. Player and title management still require admin access. Connected sockets recheck account status every 30 seconds. Dashboard player changes refresh affected players immediately; catalog edits reach existing fighters at their next account refresh. Room tokens are bound to their authenticated account, and one account holds one room session at a time.

Remember me uses persistent browser storage; unchecked sessions stay per-tab. Sign-out clears both stores and leaves the room. Use **two different accounts** for a two-window multiplayer test.

## Verification

Run `npm run test`, `npm run typecheck`, and `npm run build`. Isolated PGlite PostgreSQL tests execute the real migration and check privilege escalation, title ownership, retirement/revocation, suspension and auditing. HTTP/Socket.IO tests use an injected test account provider; there is no production bypass setting.

Real email confirmation, Google OAuth, recovery, and deployed Supabase integration require a configured-project test. After setup: register a regular player and verify admin/solo denial; grant your admin via SQL; create and assign a title; equip it as the player; suspend/reactivate the player; test two-account multiplayer, logout, reload recovery and password reset.

## Admin tools

Signed-in admins see an **Admin** button with three tabs:

- **Players**: delete a title everywhere from the **Delete a title…** dropdown (with confirmation). Search, then per player: grant a title from the dropdown (or create a new one there), remove a title with ×, **Suspend/Unsuspend** (confirmation required) and **Delete** (you must type the player's name). Deleting removes the Supabase login, profile and titles permanently. Admin accounts can't be suspended or deleted from the panel.
- **Online**: signed-in players connected right now, merged per account (with tab count), showing what each is doing — menus, lobby (room code), match (opponent, fighter, phase) or solo practice — and how long they've been connected. Also counts visitors who aren't signed in. Refreshes every 10 seconds while open; **Manage** jumps to that player in the Players tab. This comes from the game server's memory (`GET /api/admin/online`), so it needs no database migration and covers this server instance only.
- **Reports**: problems sent by players from **Menu → Report a problem** (or the in-match settings). Filter open/resolved and mark them resolved or reopen them. Each report includes the reporter's screen, room code, fighter and device. Players can send up to 5 reports per 10 minutes.

Every admin action is written to `arena_admin_audit`.

## Match records, achievements and seasons

After migration 004, every finished online match is saved to the players' records. The game server builds one summary of the match and each player's game submits it with their own login; the database only counts the match once **every human in it has submitted the identical summary**, so nobody can record a win against someone else on their own. Consequences worth knowing:

- A player who quits before the end never submits, so a quit match doesn't count for either side.
- A match against a bot is confirmed by its one human. Such matches count for that player's totals, mastery and the "bot" and single-match achievements, but **not** for the season leaderboard or the win-count achievements (10 wins, 50 wins, Dynamic Duo, Elemental Master).
- Guests (anonymous logins) keep records but are left off the leaderboard.

Achievement titles are ordinary titles: admins see them in the title list and can retire or delete them like any other.

## Guest play

The login and sign-up dialogs offer **Play as a guest**: it uses Supabase anonymous sign-ins, so a friend can join a room from an invite link without making an account first. Guests are real (anonymous) accounts: they keep records and titles on that device, and they can **Save my account** from their profile by adding an email.

To switch it on, in the Supabase dashboard:

1. Authentication → Sign In / Providers: turn on **Allow anonymous sign-ins**.
2. Same page: turn on **Allow manual linking** (needed to add an email to a guest account).
3. Run migration 004 (it marks guest profiles and names them "Guest ABCD" unless they chose a nickname).

Supabase limits anonymous sign-ins to 30 per hour per IP address by default (adjustable under Rate Limits). Supabase recommends CAPTCHA for anonymous sign-ins, but **turning CAPTCHA on also requires it for normal logins and sign-ups, which this game doesn't show a CAPTCHA for yet** — leave it off until that is added.

Guest accounts can't be recovered once the guest logs out or clears the browser (the game warns them first). Old ones aren't removed automatically; in the SQL Editor you can tidy guests inactive for 30 days:

```sql
delete from auth.users where is_anonymous is true and created_at < now() - interval '30 days';
```

Their profiles and match history rows are removed with them.
