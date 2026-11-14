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
- The logo loads from `https://parena.litojace.com/icons/arena-192.png`, so
  keep that file deployed.
- Light colours only on purpose: Gmail and Outlook recolour dark email
  backgrounds unpredictably in dark mode.
