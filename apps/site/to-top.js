// "Back to top" for the game's long pages: the website (elementarenausa.com,
// its account page) and the game site's Privacy and Support pages. The same
// file is in apps/site/ and apps/client/public/ (tests/unit/site.test.ts keeps
// them identical); each page's stylesheet styles `.to-top`.
//
// The round button shows once the reader is a screen and a half down, sits in
// the bottom corner clear of the phone's safe areas, scrolls back up (at once
// under reduced motion), and hands keyboard focus to the top of the page.
(() => {
  const button = document.createElement("a");
  button.href = "#";
  button.className = "to-top";
  button.setAttribute("aria-label", "Back to top");
  button.tabIndex = -1;
  button.setAttribute("aria-hidden", "true");
  button.innerHTML =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  document.body.append(button);

  let shown = false;
  let frame = 0;
  const update = () => {
    frame = 0;
    const on = scrollY > innerHeight * 1.5;
    if (on === shown) return;
    shown = on;
    button.classList.toggle("is-shown", on);
    button.tabIndex = on ? 0 : -1;
    button.setAttribute("aria-hidden", String(!on));
  };
  addEventListener(
    "scroll",
    () => {
      if (!frame) frame = requestAnimationFrame(update);
    },
    { passive: true },
  );
  update();

  button.addEventListener("click", (e) => {
    e.preventDefault();
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollTo({ top: 0, behavior: calm ? "instant" : "smooth" });
    // Keyboard and screen-reader users start again from the top as well.
    document
      .querySelector("header a[href], header button")
      ?.focus({ preventScroll: true });
  });
})();
