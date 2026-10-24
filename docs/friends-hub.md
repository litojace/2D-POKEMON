# Friends hub

Friends now open in a social hub with All friends, Online, Pinned and Requests
filters, name search, live activity, and static fighter avatars. Open rooms appear
first. Join and Watch only appear when the latest server presence permits them;
offline or stale room information cannot produce those actions.

Requests have separate received and sent lists, with accept, decline and cancel
actions. Removing a friend requires an inline confirmation. Mutations disable the
affected controls until they finish; a failed add keeps the typed code for retry.
Copy or share your own friend code, share the current lobby's real room invite,
or open the existing private-room creation flow from the side panel.

Pins are saved per account on this device. Search, filters, typed codes, scroll and
keyboard focus survive background presence updates. An unchanged response keeps
the current DOM. Out-of-order responses are ignored, a failed refresh retains the
last good list, and closing or replacing the screen stops its polling and listeners.

Desktop uses a scrollable crew list and a separate add/share panel. Two columns
start at 1280px; smaller windows keep wider cards in one column. Join and Watch
share an action width, and every button has at least a 44px touch target. Landscape
phones keep the filters and search fixed and open Add friend as a side panel with
a pinned close button. The Requests filter replaces the larger request preview on
compact screens. Controller directions and confirm use the existing menu controls;
right-stick scrolling works in the crew and add panels, and Back closes the top
panel or removal confirmation first. Keyboard Escape follows the same layering.
Avatars remain still, including when reduced motion is enabled.

This update uses the existing authenticated friends endpoints and room actions.
It requires no database migration or server/gameplay changes. Verification covers
empty and populated lists, long names, all requests, search, local pins, room
sharing, Join/Watch, live refresh races, failures/recovery, controller controls,
844 × 390 and 568 × 320 phones, safe areas and a shrinking keyboard viewport.

Review images: [desktop](friends-hub-desktop.png),
[landscape phone](friends-hub-mobile.png).
