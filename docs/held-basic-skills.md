# Skills while holding Basic

Basic already repeats while held, and touch contacts for movement, Basic and
other actions are independent. The dropped skill was on the server: skill input
was reset at the end of a tick even when Basic's short recovery prevented it
from casting that tick.

A discrete, ready skill tap is now buffered for up to 180 ms when the remaining
recovery fits that window. Neutral/held-Basic packets do not erase or refresh it.
Only the latest tap is retained, and it takes priority over Basic at the first
legal cast opportunity. Once consumed, held Basic resumes after the skill's
normal recovery. Dash and Jump keep their independent immediate handling.

This does not cancel a cast, bypass recovery/cooldowns, repeat a skill, speed up
Basic or queue long-unavailable abilities. EX/meter/cooldown checks still happen
at cast time. Buffers clear on death, disabling status, round/non-playing ticks,
raid stand-in handoff and Tidewyrm imprisonment.

Validation reproduces the old dropped tap, covers all eight champions, latest
intent, expiry, held-Basic resumption, EX spending and interruption cases. Real
TouchControls event tests hold movement/Basic while tapping and releasing each
normal skill, Dash and Jump independently.
