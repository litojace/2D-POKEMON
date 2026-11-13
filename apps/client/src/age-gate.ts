/**
 * A neutral age question before anyone makes an account (privacy policy,
 * "Children"). The game isn't for children under 13: under US law (COPPA) a
 * game that collects personal information from them needs verified parental
 * consent. So before signing up, playing as a guest, or signing in with
 * Apple or Google for the first time on a device, players give their month
 * and year of birth.
 *
 * Neutral, as the FTC asks: it doesn't say what age is needed or hint at
 * the "right" answer, and the answer is kept on the device so going back
 * and trying another year doesn't help. Only the outcome is kept (not the
 * date), and nothing is sent to the server. Logging in to an existing
 * account with email and password isn't asked.
 */
const KEY = "arena-age";
export const MIN_AGE = 13;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Whether someone born in that month (1–12) and year is under MIN_AGE today.
 * Without the day, someone who turns 13 this month counts as 13.
 */
export function underAge(year: number, month: number, now = new Date()) {
  const months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
  return months < MIN_AGE * 12;
}

function stored(): "ok" | "under" | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "ok" || v === "under" ? v : null;
  } catch {
    return null;
  }
}
function store(v: "ok" | "under") {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* Without storage the question is asked again next time. */
  }
}

export const UNDER_AGE_MESSAGE =
  "Sorry, you can't make an Element Arena account. Thanks for your interest in the game!";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Ask once per device. Resolves true to go on; false when the player is
 * under 13 (now or before) or closes the question.
 */
export function confirmAge(notify: (text: string) => void): Promise<boolean> {
  const before = stored();
  if (before === "ok") return Promise.resolve(true);
  if (before === "under") {
    notify(UNDER_AGE_MESSAGE);
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const now = new Date();
    const years = Array.from({ length: 101 }, (_, i) => now.getFullYear() - i);
    const wrap = document.createElement("div");
    wrap.innerHTML = `<div class="ui-scrim age-gate" data-age-gate><form class="ui-modal" role="dialog" aria-modal="true" aria-labelledby="age-gate-title"><div class="ui-modal-body"><span class="ui-kicker">Before you play</span><b class="ui-title" id="age-gate-title">When were you born?</b><div class="age-gate-row"><label><span>Month</span><select name="month" required><option value="">Month</option>${MONTHS.map((m, i) => `<option value="${i + 1}">${esc(m)}</option>`).join("")}</select></label><label><span>Year</span><select name="year" required><option value="">Year</option>${years.map((y) => `<option value="${y}">${y}</option>`).join("")}</select></label></div><p class="ui-note">We only keep whether you can make an account, on this device.</p></div><div class="ui-actions"><button type="button" class="ui-btn" data-age-cancel><span>Cancel</span></button><button type="submit" class="ui-btn is-primary"><span>Continue</span></button></div></form></div>`;
    const scrim = wrap.firstElementChild as HTMLElement;
    const form = scrim.querySelector("form")!;
    const returnFocus = document.activeElement as HTMLElement | null;
    const done = (answer: boolean) => {
      document.removeEventListener("keydown", onKey, true);
      scrim.remove();
      returnFocus?.focus?.({ preventScroll: true });
      resolve(answer);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      done(false);
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const year = Number(data.get("year")),
        month = Number(data.get("month"));
      if (!year || !month) return;
      const under = underAge(year, month, now);
      store(under ? "under" : "ok");
      if (under) notify(UNDER_AGE_MESSAGE);
      done(!under);
    };
    scrim
      .querySelector<HTMLButtonElement>("[data-age-cancel]")!
      .addEventListener("click", () => done(false));
    document.addEventListener("keydown", onKey, true);
    // Inside an open <dialog> (the login dialog), so it sits above it.
    (document.querySelector("dialog[open]") ?? document.body).append(scrim);
    scrim.querySelector<HTMLSelectElement>("select")!.focus();
  });
}
