// Element Arena website: the small amount of behaviour the page has.
// Everything reads without it; this adds the pause switch for everything
// that moves, the skin loops (played only while on screen), the element
// filter, the champion panel (data/champions.json, made from the game's
// code), the raid and Shop pickers, and panel transitions (View
// Transitions where the browser has them). No libraries.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  root.classList.add("js");

  /* ---------- Motion: one switch for every loop (WCAG 2.2.2) ---------- */
  // Paused when the reader pressed pause, or when the device asks for less
  // motion and the reader hasn't pressed play. The choice is kept on this
  // device; without storage it lasts the visit.
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  const KEY = "ea-site-motion";
  const saved = () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  };
  let paused = (saved() ?? (calm.matches ? "paused" : "on")) === "paused";
  const videos = new Set();
  const seen = new WeakMap();
  const wanted = (v) =>
    !paused && !document.hidden && seen.get(v) && !v.closest("[hidden]");
  function syncVideos() {
    for (const v of videos) {
      if (wanted(v)) {
        if (v.paused)
          v.play().catch((e) => {
            // Low Power Mode and data savers refuse to start a loop on
            // their own: show the play button, which a tap can start.
            if (e && e.name === "NotAllowedError" && !paused) {
              paused = true;
              showMotion();
            }
          });
      } else if (!v.paused) v.pause();
    }
  }
  function showMotion() {
    root.dataset.motion = paused ? "paused" : "on";
    for (const b of $$("[data-motion-toggle]"))
      b.setAttribute("aria-label", paused ? "Play motion" : "Pause motion");
    syncVideos();
  }
  const watch =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const e of entries) seen.set(e.target, e.isIntersecting);
            syncVideos();
          },
          { rootMargin: "120px 0px" },
        )
      : null;
  const addVideo = (v) => {
    videos.add(v);
    if (watch) watch.observe(v);
    else seen.set(v, true);
  };
  $$(".stage video").forEach(addVideo);
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-motion-toggle]")) return;
    paused = !paused;
    try {
      localStorage.setItem(KEY, paused ? "paused" : "on");
    } catch {
      /* No storage: for this visit only. */
    }
    showMotion();
    if (shop) shop.turn();
  });
  calm.addEventListener?.("change", () => {
    if (saved()) return;
    paused = calm.matches;
    showMotion();
  });
  document.addEventListener("visibilitychange", syncVideos);
  showMotion();

  /* ---------- Panel transitions ---------- */
  // document.startViewTransition where the browser has it (Chrome, Edge,
  // Safari 18, Firefox 144): the old and new look are captured and site.css
  // animates between them on the compositor. `kind` sets html[data-vt] so
  // site.css picks the animation; `named` are elements that take part only
  // in this transition (a name on them always would put them in every one).
  let vtToken = 0;
  const bar = $(".bar");
  function transition(kind, update, named = []) {
    if (paused || typeof document.startViewTransition !== "function") {
      update();
      return Promise.resolve(false);
    }
    const token = ++vtToken;
    root.dataset.vt = kind;
    // The page's own content moving: the fixed bar takes part too, so the
    // moving panel stays under it, as on the page.
    if (kind === "cut" || kind === "filter") named = [...named, [bar, "bar"]];
    for (const [el, name] of named) el.style.viewTransitionName = name;
    const done = () => {
      for (const [el] of named) el.style.viewTransitionName = "";
      if (token === vtToken) delete root.dataset.vt;
    };
    try {
      const t = document.startViewTransition(update);
      t.finished.then(done, done);
      // A transition skipped by the next one (a quick second tap) rejects
      // `ready`: expected, not an error.
      t.ready.catch(() => {});
      return t.updateCallbackDone.then(
        () => true,
        () => false,
      );
    } catch {
      done();
      update();
      return Promise.resolve(false);
    }
  }
  const slash = (stage) => {
    if (!stage || paused) return;
    stage.classList.remove("slash");
    void stage.offsetWidth; // restart the cut
    stage.classList.add("slash");
  };

  /* ---------- Scroll reveals, where CSS can't drive them ---------- */
  if (
    !paused &&
    !(window.CSS && CSS.supports("animation-timeline: view()")) &&
    "IntersectionObserver" in window
  ) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const fold = innerHeight;
    $$(".head, .roster > li, .modes > li, .stores > li").forEach((el, i) => {
      if (el.getBoundingClientRect().top < fold) return;
      el.classList.add("reveal");
      el.style.setProperty("--d", `${(i % 6) * 60}ms`);
      io.observe(el);
    });
  }

  /* ---------- The facts count up when they come into view ---------- */
  const facts = $$(".facts-row b");
  if (facts.length && !paused && "IntersectionObserver" in window) {
    const goal = facts.map((b) => Number(b.textContent));
    const run = () => {
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / 1100);
        const ease = 1 - (1 - t) ** 3;
        facts.forEach((b, i) => {
          b.textContent = String(Math.round(goal[i] * ease));
        });
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const shown = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      shown.disconnect();
      run();
    });
    // Counted from zero only if they start out of sight (not under the hero).
    if (facts[0].getBoundingClientRect().top > innerHeight) {
      facts.forEach((b) => (b.textContent = "0"));
      shown.observe($(".facts"));
    }
  }

  /* ---------- The bar marks the section on screen ---------- */
  const navLinks = $$('.nav a[href^="#"]');
  if (navLinks.length && "IntersectionObserver" in window) {
    const byId = new Map(navLinks.map((a) => [a.hash.slice(1), a]));
    const spy = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const a = byId.get(e.target.id);
          if (!a) continue;
          if (e.isIntersecting) {
            navLinks.forEach((l) => l.removeAttribute("aria-current"));
            a.setAttribute("aria-current", "true");
          } else if (a.getAttribute("aria-current")) {
            a.removeAttribute("aria-current");
          }
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const id of byId.keys()) {
      const section = document.getElementById(id);
      if (section) spy.observe(section);
    }
  }

  /* ---------- Element filter: the cards move to their new places ---------- */
  const chips = $(".chips");
  const cards = $$(".roster > li");
  if (chips) {
    chips.hidden = false;
    const hint = $(".hint");
    if (hint) hint.hidden = false;
    chips.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-filter]");
      if (!chip) return;
      const f = chip.dataset.filter;
      const near = (el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > -200 && r.top < innerHeight + 200;
      };
      // Only cards near the screen take part: fewer pictures to capture.
      const named = cards
        .filter((c) => !c.hidden && near(c))
        .map((c) => [
          c,
          `mon-${c.querySelector("[data-champion]").dataset.champion}`,
        ]);
      const shownAfter = cards.filter((c) => f === "all" || c.dataset.el === f);
      for (const c of shownAfter)
        if (!named.some(([n]) => n === c))
          named.push([
            c,
            `mon-${c.querySelector("[data-champion]").dataset.champion}`,
          ]);
      transition(
        "filter",
        () => {
          for (const c of $$("[data-filter]", chips))
            c.setAttribute("aria-pressed", String(c === chip));
          for (const card of cards)
            card.hidden = f !== "all" && card.dataset.el !== f;
        },
        named,
      );
    });
  }

  /* ---------- Raid bosses: pick one for the stage ---------- */
  const picks = $$(".raid-picks .pick");
  if (picks.length) {
    const stage = $(".raid-stage");
    const panels = picks.map((d) => $(`#${d.getAttribute("aria-controls")}`));
    const show = (i, focus = false) => {
      const update = () => {
        picks.forEach((d, j) => {
          d.setAttribute("aria-selected", String(i === j));
          d.tabIndex = i === j ? 0 : -1;
          panels[j].hidden = i !== j;
          panels[j].classList.remove("enter");
        });
      };
      transition("cut", update, [[stage, "raid-stage"]]).then((animated) => {
        if (!animated && !paused) {
          void panels[i].offsetWidth; // restart the entrance
          panels[i].classList.add("enter");
        }
      });
      if (focus) picks[i].focus();
    };
    $(".raid-picks").addEventListener("click", (e) => {
      const d = e.target.closest(".pick");
      if (d && d.getAttribute("aria-selected") !== "true")
        show(picks.indexOf(d));
    });
    $(".raid-picks").addEventListener("keydown", (e) => {
      const i = picks.indexOf(document.activeElement);
      if (i < 0) return;
      const n = picks.length;
      const to = {
        ArrowRight: (i + 1) % n,
        ArrowLeft: (i + n - 1) % n,
        Home: 0,
        End: n - 1,
      }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      show(to, true);
    });
  }

  /* ---------- The Shop spotlight: pick a piece; it turns on its own ---------- */
  const shopPicks = $$(".shop-picks .shop-pick");
  let shop = null;
  if (shopPicks.length) {
    const show = $(".shop-show");
    const wrap = $(".spot-wrap");
    const spots = shopPicks.map((b) =>
      $(`#${b.getAttribute("aria-controls")}`),
    );
    const TURN = 7000;
    let at = 0;
    let timer = 0;
    let stopped = false;
    let visible = false;
    // A reader's pick cuts in with a view transition; the turn on its own
    // uses the CSS entrance, so it never captures the page while the reader
    // is scrolling past.
    const pick = (i, focus = false, auto = false) => {
      at = (i + spots.length) % spots.length;
      const update = () => {
        shopPicks.forEach((b, j) => {
          b.setAttribute("aria-selected", String(j === at));
          b.tabIndex = j === at ? 0 : -1;
          spots[j].hidden = j !== at;
          spots[j].classList.remove("enter");
        });
        syncVideos();
      };
      (auto
        ? (update(), Promise.resolve(false))
        : transition("cut", update, [[wrap, "spot"]])
      ).then((animated) => {
        if (!animated && !paused) {
          void spots[at].offsetWidth; // restart the entrance
          spots[at].classList.add("enter");
        }
        slash($(".stage", spots[at]));
      });
      if (focus) shopPicks[at].focus();
    };
    // Turning: the next piece every few seconds while the spotlight is on
    // screen, the page in view and motion on; for good once the reader picks.
    const turn = () => {
      const on = visible && !document.hidden && !paused && !stopped;
      clearInterval(timer);
      timer = 0;
      show.classList.toggle("turning", on);
      if (!on) return;
      show.style.setProperty("--turn-ms", `${TURN}ms`);
      timer = setInterval(() => {
        pick(at + 1, false, true);
        // Restart the bar under the new piece.
        show.classList.remove("turning");
        void show.offsetWidth;
        show.classList.add("turning");
      }, TURN);
    };
    const stop = () => {
      stopped = true;
      turn();
    };
    shop = { turn };
    if ("IntersectionObserver" in window)
      new IntersectionObserver((entries) => {
        visible = entries.some((e) => e.isIntersecting);
        turn();
      }).observe(show);
    document.addEventListener("visibilitychange", turn);
    $(".shop-picks").addEventListener("click", (e) => {
      const b = e.target.closest(".shop-pick");
      if (!b) return;
      stop();
      if (b.getAttribute("aria-selected") !== "true")
        pick(shopPicks.indexOf(b));
    });
    $(".shop-picks").addEventListener("keydown", (e) => {
      const i = shopPicks.indexOf(document.activeElement);
      if (i < 0) return;
      const n = shopPicks.length;
      const to = {
        ArrowRight: i + 1,
        ArrowLeft: i - 1,
        Home: 0,
        End: n - 1,
      }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      stop();
      pick(to, true);
    });
  }

  /* ---------- Champion panel ---------- */
  const dialog = $("#champ");
  if (!dialog || !dialog.showModal) return;
  const video = $("#champ-video");
  addVideo(video);
  let data = null;
  let loading = null;
  let current = -1;
  let tab = 0;
  let opener = null;
  /** Where a click outside the panel closed it (x, y), if one did. */
  let closedAt = null;
  const load = () =>
    (loading ??= fetch("data/champions.json")
      .then((r) => r.json())
      .then((d) => (data = d)));
  // Warm the data once the page is idle, so the first tap opens at once.
  (window.requestIdleCallback || setTimeout)(() => load().catch(() => {}), {
    timeout: 3000,
  });

  const STATUS = {
    burn: "Burns",
    paralysis: "Paralyzes",
    slow: "Slows",
    stun: "Stuns",
    freeze: "Freezes",
    silence: "Silences",
    root: "Roots",
    blind: "Blinds",
    confuse: "Confuses",
    taunt: "Taunts",
    leash: "Leashes",
    grounded: "Grounds",
  };
  const RARITY = {
    mythical: "Mythical",
    legendary: "Legendary",
    epic: "Epic",
    rare: "Rare",
    common: "Common",
  };
  // What each loop plays (the fitting room's showcase, skins.spec.ts).
  const PLAYS = {
    mythical: "casting its ultimate at Stage III",
    legendary: "playing its victory",
  };
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const range = (key) => {
    const v = data.map((c) => c[key]);
    return [Math.min(...v), Math.max(...v)];
  };
  const reachWord = (r) => (r <= 200 ? "Close" : r <= 500 ? "Mid" : "Long");

  function moves(c) {
    return [
      { slot: "Basic", ...c.basic },
      ...c.skills.map((s, i) => ({ slot: `Skill ${i + 1}`, ...s })),
      { slot: "Ultimate", ult: true, ...c.ultimate },
    ];
  }

  function showMove(c, i) {
    tab = i;
    const list = moves(c);
    $$("#champ-tabs [role=tab]").forEach((t, j) => {
      t.setAttribute("aria-selected", String(j === i));
      t.tabIndex = j === i ? 0 : -1;
    });
    const m = list[i];
    const box = $("#champ-move");
    box.replaceChildren();
    box.setAttribute("aria-labelledby", `champ-tab-${i}`);
    box.append(
      el("p", "move-slot", m.slot),
      el("h4", "move-name", m.name),
      el("p", "move-desc", m.description),
    );
    const facts = el("ul", "move-facts");
    if (m.damage) facts.append(el("li", "", `${m.damage} damage`));
    if (m.interval) facts.append(el("li", "", `every ${m.interval}s`));
    if (m.cooldown && !m.ult)
      facts.append(el("li", "", `${m.cooldown}s cooldown`));
    if (m.ult) facts.append(el("li", "", "Charges from the ultimate meter"));
    if (m.status && STATUS[m.status])
      facts.append(el("li", "", STATUS[m.status]));
    if (facts.children.length) box.append(facts);
    box.classList.remove("pop");
    void box.offsetWidth; // restart the entrance (only on a tab change)
    box.classList.add("pop");
  }

  // The look on the stage: the loop of the fitting room playing it.
  function wear(c, skin) {
    const name = skin ? skin.id : c.id;
    const show = $("#champ-show");
    show.className = `stage${skin ? ` r-${skin.rarity}` : ""}`;
    video.poster = `img/skins/${name}.webp`;
    video.src = `media/skins/${name}.mp4`;
    video.setAttribute(
      "aria-label",
      skin
        ? `${c.name} in ${skin.name}, ${PLAYS[skin.rarity] ?? "in the game's fitting room"}`
        : `${c.name}, the Classic look, playing its entrance and then its victory`,
    );
    const look = $("#champ-look");
    look.replaceChildren(
      el("b", "", skin ? RARITY[skin.rarity] : "Classic"),
      document.createTextNode(skin ? skin.name : c.name),
    );
    $$("#champ-skins button").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.look === name)),
    );
    seen.set(video, true);
    syncVideos();
  }

  function render(i) {
    current = (i + data.length) % data.length;
    const c = data[current];
    dialog.style.setProperty("--el", `var(--el-${c.element.toLowerCase()})`);
    $("#champ-big").textContent = c.name;
    $("#champ-el").textContent = c.element;
    $("#champ-name").textContent = c.name;
    $("#champ-role").textContent = c.role;
    $("#champ-desc").textContent = c.description;

    const stats = $("#champ-stats");
    stats.replaceChildren();
    for (const [label, key, text] of [
      ["Health", "health", c.health],
      ["Speed", "speed", c.speed],
      ["Reach", "reach", `${reachWord(c.reach)} · ${c.reach}`],
    ]) {
      const [lo, hi] = range(key);
      const share = 0.18 + (0.82 * (c[key] - lo)) / (hi - lo || 1);
      const row = el("div", "stat");
      const bar = el("span", "meter");
      bar.style.setProperty("--v", share.toFixed(3));
      bar.setAttribute("aria-hidden", "true");
      row.append(el("dt", "", label), el("dd", "", String(text)), bar);
      stats.append(row);
    }
    const passive = $("#champ-passive");
    passive.hidden = !c.passive;
    passive.textContent = c.passive ? `Passive: ${c.passive}` : "";

    const tabs = $("#champ-tabs");
    tabs.replaceChildren();
    moves(c).forEach((m, j) => {
      const t = el("button", m.ult ? "mv ult" : "mv");
      t.type = "button";
      t.id = `champ-tab-${j}`;
      t.setAttribute("role", "tab");
      t.setAttribute("aria-controls", "champ-move");
      t.append(
        el(
          "span",
          "mv-k",
          m.ult ? "Ult" : m.slot === "Basic" ? "Basic" : String(j),
        ),
        el("span", "mv-n", m.name),
      );
      t.addEventListener("click", () => showMove(c, j));
      tabs.append(t);
    });
    showMove(c, 0);

    // The skins: Classic first, then the featured ones (rarest first),
    // each a still of its own loop.
    const skins = $("#champ-skins");
    skins.replaceChildren();
    const looks = [null, ...c.skins];
    for (const s of looks) {
      const li = el("li");
      const b = el("button", s ? `skin r-${s.rarity}` : "skin");
      b.type = "button";
      b.dataset.look = s ? s.id : c.id;
      b.title = s ? `${s.name} (${RARITY[s.rarity]})` : "Classic";
      b.setAttribute("aria-pressed", "false");
      b.append(
        Object.assign(new Image(), {
          src: `img/skins/${s ? s.id : c.id}-thumb.webp`,
          alt: "",
          width: 192,
          height: 192,
          decoding: "async",
        }),
        el("span", "skin-n", s ? `${s.name}, ${RARITY[s.rarity]}` : "Classic"),
      );
      b.addEventListener("click", () => {
        if (b.getAttribute("aria-pressed") === "true") return;
        transition("look", () => wear(c, s)).then(() =>
          slash($("#champ-show")),
        );
      });
      li.append(b);
      skins.append(li);
    }
    $("#champ-count").textContent =
      `Showing ${c.skins.length} of ${c.skinCount} skins · see them all in the Shop`;
    wear(c, null);
    if (location.hash !== `#champion-${c.id}`)
      history.replaceState(null, "", `#champion-${c.id}`);
  }

  // The card's portrait grows into the stage, and back on closing.
  const cardArt = (id) =>
    $(`.roster [data-champion="${id}"] img`) ||
    $(`.ticker [data-champion="${id}"]:not([aria-hidden]) img`);

  async function open(id, from) {
    try {
      await load();
    } catch {
      return false; // no data: the link just stays on the roster
    }
    const i = data.findIndex((c) => c.id === id);
    if (i < 0) return false;
    if (dialog.open) {
      render(i);
      return true;
    }
    opener = from || null;
    const art = from?.querySelector("img") || cardArt(id);
    const visible =
      art &&
      (() => {
        const r = art.getBoundingClientRect();
        return r.bottom > 0 && r.top < innerHeight && r.width > 0;
      })();
    await transition(
      "open",
      () => {
        if (visible) art.style.viewTransitionName = "";
        render(i);
        dialog.showModal();
        root.classList.add("panel-open");
      },
      visible ? [[art, "champ-art"]] : [],
    );
    $("#champ-tabs [aria-selected=true]")?.focus({ preventScroll: true });
    return true;
  }

  function close() {
    if (!dialog.open) return;
    const id = data?.[current]?.id;
    const art = id && cardArt(id);
    const r = art?.getBoundingClientRect();
    const visible = r && r.bottom > 0 && r.top < innerHeight && r.width > 0;
    transition("close", () => {
      dialog.close();
      if (visible) art.style.viewTransitionName = "champ-art";
    }).then(() => {
      if (visible) setTimeout(() => (art.style.viewTransitionName = ""), 600);
    });
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-champion]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    void open(a.dataset.champion, a);
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) closedAt = [e.clientX, e.clientY];
    if (e.target === dialog || e.target.closest("[data-close]")) close();
    const step = e.target.closest("[data-step]");
    if (step) {
      const by = Number(step.dataset.step);
      transition(by > 0 ? "next" : "prev", () => render(current + by));
    }
  });
  dialog.addEventListener("cancel", (e) => {
    // Escape: close with the same transition as the close button.
    e.preventDefault();
    close();
  });
  dialog.addEventListener("keydown", (e) => {
    const inTabs = e.target.closest?.("#champ-tabs");
    if (inTabs && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      const n = $$("#champ-tabs [role=tab]").length;
      showMove(
        data[current],
        (tab + (e.key === "ArrowRight" ? 1 : -1) + n) % n,
      );
      $("#champ-tabs [aria-selected=true]").focus();
    }
  });
  dialog.addEventListener("close", () => {
    root.classList.remove("panel-open");
    video.pause();
    if (location.hash.startsWith("#champion-"))
      history.replaceState(null, "", location.pathname + location.search);
    const card =
      (opener?.isConnected && opener) ||
      (data && $(`.roster [data-champion="${data[current]?.id}"]`));
    card?.focus({ preventScroll: true });
    opener = null;
    // Closed by a click that landed on the champion tape: the tape runs on
    // under the resting mouse until it leaves (it holds still for a mouse
    // that comes to it, not for one left there; owner, 27 Nov).
    const tape = $(".ticker");
    const at = closedAt;
    closedAt = null;
    if (tape && at) {
      const r = tape.getBoundingClientRect();
      if (
        at[0] >= r.left &&
        at[0] <= r.right &&
        at[1] >= r.top &&
        at[1] <= r.bottom
      ) {
        tape.classList.add("free");
        // Until the mouse is anywhere else. Not the tape's own pointerleave:
        // the panel's backdrop covered the tape until now, so the browser
        // may not have counted the mouse as inside it yet, and a mouse that
        // moves off before it does never sends one (the tape then stayed
        // free, and didn't hold for the mouse that came back).
        const away = (e) => {
          if (tape.contains(e.target)) return;
          tape.classList.remove("free");
          document.removeEventListener("pointermove", away);
        };
        document.addEventListener("pointermove", away);
      }
    }
  });
  // A shared link straight to a champion (#champion-voltkit).
  const deep = location.hash.match(/^#champion-([a-z]+)$/);
  if (deep) void open(deep[1]);
})();
