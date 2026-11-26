# Auth email templates

Branded HTML for the emails Supabase Auth sends (through Resend, from
`Element Arena <noreply@mail.litojace.com>`). Supabase does not read these
files: paste each one into **Supabase → Authentication → Emails → Templates**.

| Template in Supabase | Subject | File |
|---|---|---|
| Confirm signup | `Confirm your Element Arena account` | `confirm-signup.html` |
| Reset password | `Reset your Element Arena password` | `reset-password.html` |
| Change email address | `Confirm your new Element Arena email` | `change-email.html` |
| Reauthentication | `Your Element Arena verification code` | `reauthentication.html` |

- `{{ .ConfirmationURL }}` and `{{ .Email }}` are Supabase template variables;
  keep them as they are. `change-email.html` also uses `{{ .NewEmail }}`, and
  `reauthentication.html` uses `{{ .Token }}`. No variable goes into an image
  URL or a query string we write.
- **Change email address:** with **Secure email change** on (Authentication →
  Providers → Email), Supabase sends this one to both the old and the new
  address; the change happens only once it is confirmed. It shows
  old → new and tells anyone who didn't ask to change their password.
- **Reauthentication:** the 6-digit code (`{{ .Token }}`) a player types to
  prove it's them, with no link: an Apple account setting its first password,
  or a password change on a session older than 24 hours when **Secure
  password change** is on. It says never to share the code.
  Replace Supabase's default subject (`{{ .Token }} is your verification
  code`) with the one in the table: a code in the subject shows on lock
  screens and in notification previews.
- Images load from the live site: `/icons/arena-192.png` and
  `/email/hero.jpg` (in `apps/client/public`). **Deploy them before pasting
  the templates**, or the banner shows as a broken image.
- Dark design on purpose, like the game. Mail apps that only recolour light
  backgrounds leave it alone; apps that invert everything flip text and
  background together, so it stays readable.
- The banner is drawn with the game's own renderers: the Coliseum court
  (`paintCourtStands` / `paintCourtFloor`) and champions posed by the real
  animation rig (`FighterRig`), with their Shop skins. To change it:
  1. Edit `banner/cast.json` (champion, `state` such as `victory`, `hurt`,
     `skill3`, `phase` 0..1, facing `LEFT`/`RIGHT`/`FRONT`, `skin`).
  2. Start the visual-test server: `npx vite --config tests/visual/vite.config.ts`.
  3. `PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node supabase/templates/banner/render.cjs`
     (drop `PW_CHROMIUM` outside the cloud container).
  4. Adjust positions in `banner/hero.html`, open it in Chromium at 600x240,
     screenshot `.b` at 2x and save it as JPEG (about 85 quality) to
     `apps/client/public/email/hero.jpg`.
  Arm-raising moves (waves) hide behind the champions' big heads in a still
  frame, so pick moves that read: victory hops and flips, hurt, skills.
