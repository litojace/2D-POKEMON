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
- `hero-source.html` builds the banner from the creature portraits and the
  plaza background. To change it, edit that file, open it in Chromium at
  600x240 and screenshot `.b` at 2x, then save as JPEG (about 85 quality).
