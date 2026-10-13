# Separate game accounts

Element Arena follows AMATYC's Supabase auth pattern: email/password signup and login, email confirmation, Google sign-in, password recovery, and optional remembered sessions. Create a **new Supabase project for the game**. Its accounts remain separate from AMATYC. No administrator or default password is shipped.

## Database

In the new project's Supabase SQL Editor, run [001_arena_accounts.sql](../supabase/migrations/001_arena_accounts.sql). It creates profiles, admin membership, title definitions/ownership, and an admin audit log. Then run [002_admin_cleanup_reports.sql](../supabase/migrations/002_admin_cleanup_reports.sql), which adds problem reports and the admin suspend/delete functions. Then run [003_titles.sql](../supabase/migrations/003_titles.sql), which records when titles were created (newest custom titles list first) and lets admins delete titles. Profiles are created when users first log into the game. User-controlled signup metadata cannot grant admin rights. Passwords remain in Supabase Auth.

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

Signed-in admins see an **Admin** button with two tabs:

- **Players**: delete a title everywhere from the **Delete a title…** dropdown (with confirmation). Search, then per player: grant a title from the dropdown (or create a new one there), remove a title with ×, **Suspend/Unsuspend** (confirmation required) and **Delete** (you must type the player's name). Deleting removes the Supabase login, profile and titles permanently. Admin accounts can't be suspended or deleted from the panel.
- **Reports**: problems sent by players from **Menu → Report a problem** (or the in-match settings). Filter open/resolved and mark them resolved or reopen them. Each report includes the reporter's screen, room code, fighter and device. Players can send up to 5 reports per 10 minutes.

Every admin action is written to `arena_admin_audit`.
