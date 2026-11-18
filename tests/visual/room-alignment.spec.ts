import { expect, test, type Page } from "@playwright/test";
import {
  openHub,
  openPlayPanel,
  pickRoomMode,
  createRoom,
  snap,
} from "./helpers";
import { ISLAND, setInsets, layoutProblems } from "./ui-measure";

// The PvP room's seats and banner line up (docs/hidden-picks.md), in every
// mode, from a small phone to a desktop: the pick tiles in one column, the
// state tags one width, avatars and the pick/state block centred on their
// row, the left edges of the team heads and the seats flush, the chat and
// ⋯ buttons level in the banner's corners, the mode's name centred between
// them, and no text wrapped or cut (the owner, 18 Nov).
const SIZES = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "844x390", width: 844, height: 390, phone: true },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    phone: true,
    island: true,
  },
  { name: "568x320", width: 568, height: 320, phone: true },
];

type Box = { x: number; y: number; w: number; h: number };
const mid = (b: Box) => b.y + b.h / 2;

/** Everything measured, as plain numbers. */
function measure(page: Page) {
  return page.evaluate(() => {
    const R = (e: Element | null) => {
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    /** Lines a piece of text takes (a visually hidden one counts as none). */
    const lines = (e: Element) => {
      const range = document.createRange();
      range.selectNodeContents(e);
      return new Set(
        [...range.getClientRects()]
          .filter((q) => q.width > 1)
          .map((q) => Math.round(q.top)),
      ).size;
    };
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    return {
      banner: R(document.querySelector(".room-banner"))!,
      title: R(document.querySelector(".room-banner-name"))!,
      chat: R(document.querySelector("#chat-button"))!,
      more: R(document.querySelector(".room-more"))!,
      bannerText: [
        ...document.querySelectorAll(
          ".room-banner .ui-kicker, .room-banner-name, .room-banner-line",
        ),
      ]
        .filter(visible)
        .map((e) => ({ text: e.textContent ?? "", lines: lines(e) })),
      heads: [...document.querySelectorAll(".room-seats .room-head")].map((h) =>
        R(h)!,
      ),
      seats: [...document.querySelectorAll(".room-seats .room-seat")].map(
        (s) => ({
          open: s.classList.contains("is-open"),
          row: R(s)!,
          avatar: R(s.querySelector(".room-avatar, .room-plus"))!,
          text: R(s.querySelector(".room-seat-text"))!,
          pick: R(s.querySelector(".room-pick")),
          state: R(s.querySelector(".room-state")),
          cut: [
            ...s.querySelectorAll(
              ".room-seat-text b, .room-seat-text small, .ui-tag",
            ),
          ]
            .filter(visible)
            .filter(
              (e) =>
                (e as HTMLElement).scrollWidth >
                (e as HTMLElement).clientWidth + 1,
            )
            .map((e) => e.textContent ?? ""),
        }),
      ),
      topbar: getComputedStyle(document.querySelector(".topbar")!).display,
    };
  });
}
type M = Awaited<ReturnType<typeof measure>>;

/** What's out of line, in words (empty when the room is right). */
function misaligned(m: M) {
  const out: string[] = [];
  const near = (a: number, b: number, d = 1) => Math.abs(a - b) <= d;
  const taken = m.seats.filter((s) => !s.open);
  const picks = taken.map((s) => s.pick!.x);
  if (Math.max(...picks) - Math.min(...picks) > 1)
    out.push(`pick tiles not in one column: ${picks.join(", ")}`);
  const states = taken.map((s) => s.state!);
  if (!states.every((s) => near(s.x, states[0].x) && near(s.w, states[0].w)))
    out.push(`state tags differ: ${states.map((s) => `${s.x}+${s.w}`)}`);
  for (const s of taken) {
    if (!near(mid(s.avatar), mid(s.row)))
      out.push(
        `avatar off its row's middle (${mid(s.avatar)} / ${mid(s.row)})`,
      );
    const top = Math.min(s.pick!.y, s.state!.y);
    const bottom = Math.max(s.pick!.y + s.pick!.h, s.state!.y + s.state!.h);
    if (!near((top + bottom) / 2, mid(s.row), 1.5))
      out.push(`pick and state off the row's middle`);
    if (s.cut.length) out.push(`cut text: ${s.cut.join(" | ")}`);
  }
  const texts = m.seats.map((s) => s.text.x);
  if (Math.max(...texts) - Math.min(...texts) > 1)
    out.push(`seat text doesn't start in one column: ${texts.join(", ")}`);
  const lefts = [...m.heads.map((h) => h.x), ...m.seats.map((s) => s.row.x)];
  if (Math.max(...lefts) - Math.min(...lefts) > 1)
    out.push(`heads and seats not flush left: ${lefts.join(", ")}`);
  const { banner: b, chat: c, more: o, title: t } = m;
  if (!near(mid(c), mid(o), 0.6)) out.push("chat and ⋯ not level");
  if (!near(c.x - b.x, b.x + b.w - (o.x + o.w), 0.6))
    out.push("chat and ⋯ not the same distance from their corners");
  if (c.y < b.y - 0.5 || c.y + c.h > b.y + b.h + 0.5 || c.x < b.x - 0.5)
    out.push("chat button outside the banner");
  if (!near(t.x + t.w / 2, b.x + b.w / 2, 1.5))
    out.push("mode name off centre");
  if (t.x < c.x + c.w || t.x + t.w > o.x)
    out.push("mode name runs under a button");
  if (t.y + t.h > b.y + b.h + 0.5) out.push("mode name below the banner");
  for (const line of m.bannerText)
    if (line.lines > 1) out.push(`"${line.text}" wraps (${line.lines} lines)`);
  if (m.topbar !== "none") out.push("the top bar shows in a room");
  return out;
}

for (const size of SIZES)
  for (const mode of ["teams", "duel", "ffa"] as const)
    test(`the ${mode} room lines up at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(120_000);
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: !!size.phone,
        hasTouch: !!size.phone,
      });
      try {
        const page = await context.newPage();
        const errors = await openHub(page);
        if (size.island) await setInsets(page, ISLAND);
        // Every state at once: you choosing (and hosting), a teammate ready,
        // an opponent locked in, one still choosing.
        await page.evaluate((mode) => {
          const w = window as any;
          w.__room("pvp", { mode, phase: "lobby" });
          const by = (id: string) =>
            w.__snap.players.find((p: any) => p.id === id);
          if (by("p3")) by("p3").ready = true;
          if (by("p4")) by("p4").locked = false;
        }, mode);
        await openPlayPanel(page);
        await pickRoomMode(page, mode);
        await createRoom(page);
        await expect
          .poll(async () => {
            await page.evaluate(() => (window as any).__push());
            return page.locator(".room-screen .roster-room").count();
          })
          .toBe(1);
        await page.waitForTimeout(500);
        expect(misaligned(await measure(page))).toEqual([]);
        expect(
          await layoutProblems(page, {
            inset: size.island ? ISLAND : undefined,
            phone: !!size.phone,
          }),
        ).toEqual([]);
        await snap(page, info, `room-alignment-${mode}-${size.name}`);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
