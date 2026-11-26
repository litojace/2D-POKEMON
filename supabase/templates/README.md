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
- The banner is the loading-screen painting **rest-market**
  (`apps/client/src/art/loading-art/startup-art-rest-market.webp`, chosen by
  the owner on 25 Nov), cropped to 2.5:1 a little below the middle and saved
  at 1200x480 (shown at 600x240, sharp on phones) as JPEG, quality 85:

  ```bash
  python3 -c "from PIL import Image; im=Image.open('apps/client/src/art/loading-art/startup-art-rest-market.webp').convert('RGB'); w,h=im.size; t=int(w/2.5); y=int((h-t)*0.55); im.crop((0,y,w,y+t)).resize((1200,480),Image.LANCZOS).save('apps/client/public/email/hero.jpg',quality=85,optimize=True,progressive=True)"
  ```

  Any other painting in that folder works the same way. Update the `alt`
  text in the templates to match. The file keeps its name, so emails
  already sent show the new picture too.
