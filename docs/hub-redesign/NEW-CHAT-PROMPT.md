# Starter message for the implementation session

Paste the block below as the first message of a new chat on `litojace/2d-pokemon`.

```text
We are starting the real implementation of the hub redesign (Lobby, Plaza, Elemental Farm).
The design was finished as a prototype in an earlier session. Read these first, in this order:

1. docs/hub-redesign/README.md       – what was built, decisions, rules for the real game, suggested phases, open questions
2. docs/hub-redesign/NUMBERS.md      – every tuning number (generated from the prototype source)
3. docs/hub-redesign/prototype/app/  – prototype source (farm.js, crops.js, plaza.js, progress.js, icons.js, art.js)
4. docs/hub-redesign/images/         – screenshots of the approved look

Then, before writing code:
- Map each feature in the README to the real code (packages/shared, apps/client, apps/server, supabase/migrations)
  and tell me what already exists, what changes and what is new.
- Ask me the "Open questions for the owner" from the README.
- Propose a phase plan (README "Suggested order of work") with what each phase ships and how we test it.

Ground rules:
- I write in Vietnamese; reply to me in Vietnamese. All in-game text stays in English.
- The server owns time and money: no gameplay timer or economy change may trust the client.
- Keep the UI rules from the README (fixed-size HUD boxes, aligned buttons, phone landscape without overlaps).
- Work on a feature branch and open a pull request into main for each phase, unless I explicitly say to push
  straight to main. Run npm run typecheck, npm run test and npm run build before every push.
- Double-check your work and tell me plainly what was verified and what was not.
```
