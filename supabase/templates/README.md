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
- The banner is drawn from the game's own creature art (`creatureSvg` in
  `apps/client/src/creature-design.ts`), so faces and Shop skins match the
  game. To change it: edit the cast (champion, facing, mood, skin) in
  `banner/gen.ts` and the layout in `banner/hero.html`, then
  `npx tsx supabase/templates/banner/gen.ts`, open `banner/hero.html` in
  Chromium at 600x240, screenshot `.b` at 2x and save it as JPEG (about 85
  quality) to `apps/client/public/email/hero.jpg`.
