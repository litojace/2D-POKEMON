# Auth email templates

Branded HTML for the emails Supabase Auth sends (through Resend, from
`Element Arena <noreply@mail.litojace.com>`). Supabase does not read these
files: paste each one into **Supabase → Authentication → Emails → Templates**.

| Template in Supabase | Subject | File |
|---|---|---|
| Confirm signup | `Confirm your Element Arena account` | `confirm-signup.html` |
| Reset password | `Reset your Element Arena password` | `reset-password.html` |

- `{{ .ConfirmationURL }}` and `{{ .Email }}` are Supabase template variables;
  keep them as they are.
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
