# Mobile combat controls

The approved layout keeps Basic large near the right thumb, skills 1–3 along
one circular arc, Ultimate above them, and Dash/Jump beside the right edge.
Skills use a common 104-unit radius around Basic with 42-degree intervals,
so both neighbouring gaps and their clearance from Basic are equal.

On an 844×390 viewport with default settings, skill circles are about 60 CSS px,
Basic 92 px, and Ultimate 63 px. The icon artwork retains its previous scale.
Button-size preferences still apply, with minimum 44 px targets; very small
screens retain the existing compact fallback.

Ultimate displays its charge and ULT label. EX can still be armed when available;
the armed state and accessible label retain that information without placing
an oversized EX prefix beside the charge percentage.

Validation covers scaled geometry, viewport bounds, equal arc gaps, EX arming,
and existing touch interruption/recovery scenarios. Preview-only styles are
not needed for the production screenshots in mobile-combat-layout.spec.ts.
