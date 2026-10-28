# Raid practice, rites and nearby friends

Boss practice starts in Raid Hub → boss → Overview → Boss skills. Each attack has a
mechanic icon, a short practice instruction and a dedicated practice action. The raid
ready drawer no longer contains the picker, and the Hub no longer offers code
joining. Friends invitations remain the way to join a party.

Practice enters the playing phase immediately, without a countdown or rite choice;
players can move right away while the first attack keeps its normal warning lead-in.

The in-court practice strip starts collapsed. Its instructions, attack switcher
and leave-practice action expand on demand. Updating hit/dodge counters preserves
the controls and focus rather than replacing the entire picker. On mobile, the
expanded picker widens to 320px (within safe areas), allows full attack names to
wrap, and keeps Leave practice outside the scrolling instructions/attack list.
Each boss offers six attacks in two rows of three. Emberwing's brazier lighting
remains an arena mechanic rather than a seventh attack button. The panel sits
closer to the bottom edge (12px plus safe area on touch screens).
Attack buttons are at least 36px tall; the collapsed strip keeps its compact size.
The selected attack exposes its pressed state to assistive technology.

Rites use authored effect illustrations with aligned stat badges beneath them;
on very short landscape screens these sit side by side. Buff values and mechanics
are unchanged. Full effect details remain accessible without selecting a rite.

Town shows up to three nearby players within 240 world units, ordered by distance.
Their server-provided account ids let the existing authenticated Friends request
endpoint send an invitation without a code. This does not auto-accept friendship.
The panel refreshes at most four times per second and only rebuilds when its list
changes. Town camera follow uses elapsed time and subpixel positions, and local position corrections use
a wider moving tolerance and slower correction to reduce small backward pulls.
This is not a claim of measured FPS improvement on a physical phone.
