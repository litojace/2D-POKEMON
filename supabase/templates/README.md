# Auth email templates

Branded HTML for the emails Supabase Auth sends (through Resend, from
`Element Arena <noreply@mail.elementarenausa.com>`). Supabase does not read these
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
- **Reauthentication:** the one-time code (`{{ .Token }}`, 8 digits with the project's current Email OTP length) a player types to
  prove it's them, with no link: an Apple account setting its first password,
  or a password change on a session older than 24 hours when **Secure
  password change** is on. It says never to share the code.
  Replace Supabase's default subject (`{{ .Token }} is your verification
  code`) with the one in the table: a code in the subject shows on lock
  screens and in notification previews.
- Images load from the live site: `/icons/arena-192.png` and
  `/email/hero.jpg` (in `apps/client/public`). **Deploy them before pasting
  the templates**, or the banner shows as a broken image.
- **Always dark, like the game** (owner, 25 Nov), also in mail apps that
  recolour emails in dark mode. Gmail on iPhone inverts the whole email,
  dark backgrounds included (a dark email turned light lavender with olive
  text), and ignores `color-scheme`. So:
  - Every coloured surface has its colour three times: `bgcolor`, inline
    `background-color`, and a `bg-*` class in `<style>` that paints the same
    colour as `linear-gradient(c, c)`. Gmail inverts colours but not
    background images. The class is in `<style>`, not inline: Gmail on
    Android breaks an inline `background-image` gradient
    ([email-bugs #135](https://github.com/hteumeuleu/email-bugs/issues/135)).
  - Every coloured text has a `t-*` class. Only in Gmail (`u + .body`, the
    `<u>` Gmail puts before the body, hence `<body class="body">`), it paints
    the text with a gradient of its own colour clipped to the letters
    (`background-clip: text; color: transparent`), so gold stays gold and
    white stays white after the inversion. This is the coloured-text
    variant of Rémi Parmentier's Gmail fix
    ([email-darkmode](https://github.com/matthieuSolente/email-darkmode),
    from email-bugs #68). Gmail keeps `<style>` only for Gmail and Google
    Workspace accounts; with another account in the Gmail app it may still
    invert.
  - No borders: lines and frames (the card's edge, dividers, the code box)
    are 1–2 px of a `bg-*` background around the content.
  - `color-scheme: dark` (meta and CSS) tells Apple Mail and other apps that
    read it not to recolour. Outlook's apps recolour and mark what they
    changed (`data-ogsc`, `data-ogsb`); `<style>` sets the gold button and
    its dark text back.
  - Support data: [caniemail](https://www.caniemail.com/) (linear-gradient,
    background-clip, color-scheme, prefers-color-scheme rows).
  - `tests/unit/email-templates.test.ts` checks each colour has its class.
    A new colour needs both a `bg-*`/`t-*` rule in every template's
    `<style>` and the class on the element.
  - Contrast (WCAG AA): body text `#a9b4c9` on the card 8.3:1, footer
    `#8a95ad` on the page 6.3:1, dark text on the gold button 13.5:1.
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
