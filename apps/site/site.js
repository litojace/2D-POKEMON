// Element Arena website: the small amount of behaviour the page has.
// Everything reads without it; this adds the element filter, the champion
// panel (data/champions.json, made from the game's code), scroll reveals
// and the hero's parallax. No libraries.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  const root = document.documentElement;
  root.classList.add("js");

  /* ---------- Scroll reveals: only for what starts below the fold ---------- */
  if (!calm.matches && "IntersectionObserver" in window) {
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
    $$(
      ".head, .roster > li, .modes > li, .bosses > li, .perks > li, .stores > li",
    ).forEach((el, i) => {
      if (el.getBoundingClientRect().top < fold) return;
      el.classList.add("reveal");
      el.style.setProperty("--d", `${(i % 6) * 60}ms`);
      io.observe(el);
    });
  }

  /* ---------- Hero parallax (desktop pointers only) ---------- */
  const art = $(".hero-art img");
  if (
    art &&
    !calm.matches &&
    matchMedia("(hover: hover) and (min-width: 900px)").matches
  ) {
    let raf = 0;
    addEventListener("pointermove", (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const x = (e.clientX / innerWidth - 0.5) * -14;
        const y = (e.clientY / innerHeight - 0.5) * -10;
        art.style.translate = `${x}px ${y}px`;
      });
    });
  }

  /* ---------- Element filter ---------- */
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
      for (const c of $$("[data-filter]", chips))
        c.setAttribute("aria-pressed", String(c === chip));
      for (const card of cards)
        card.hidden = f !== "all" && card.dataset.el !== f;
    });
  }

  /* ---------- Champion panel ---------- */
  const dialog = $("#champ");
  if (!dialog || !dialog.showModal) return;
  let data = null;
  let loading = null;
  let current = -1;
  let tab = 0;
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
    if (!calm.matches) {
      box.classList.remove("pop");
      void box.offsetWidth; // restart the entrance (only on a tab change)
      box.classList.add("pop");
    }
  }

  function render(i) {
    current = (i + data.length) % data.length;
    const c = data[current];
    dialog.style.setProperty("--el", `var(--el-${c.element.toLowerCase()})`);
    const art = $("#champ-art");
    art.src = `img/creatures/${c.id}.svg`;
    art.alt = c.name;
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

    const skins = $("#champ-skins");
    skins.replaceChildren();
    $("#champ-skins-h").textContent =
      `Featured skins · ${c.skinCount} in the Wardrobe`;
    const base = el("li");
    const pick = (btn, src, alt) => {
      $$("button", skins).forEach((b) =>
        b.setAttribute("aria-pressed", String(b === btn)),
      );
      art.src = src;
      art.alt = alt;
    };
    const b0 = el("button", "skin");
    b0.type = "button";
    b0.setAttribute("aria-pressed", "true");
    b0.append(
      Object.assign(new Image(), {
        src: `img/creatures/${c.id}.svg`,
        alt: "",
        loading: "lazy",
        width: 64,
        height: 64,
      }),
      el("span", "skin-n", "Classic"),
    );
    b0.addEventListener("click", () =>
      pick(b0, `img/creatures/${c.id}.svg`, c.name),
    );
    base.append(b0);
    skins.append(base);
    for (const s of c.skins) {
      const li = el("li");
      const b = el("button", `skin r-${s.rarity}`);
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.append(
        Object.assign(new Image(), {
          src: `img/skins/${s.id}.svg`,
          alt: "",
          loading: "lazy",
          width: 64,
          height: 64,
        }),
        el("span", "skin-n", s.name),
        el("span", "skin-r", RARITY[s.rarity]),
      );
      b.addEventListener("click", () =>
        pick(b, `img/skins/${s.id}.svg`, `${c.name} in ${s.name}`),
      );
      li.append(b);
      skins.append(li);
    }
    if (location.hash !== `#champion-${c.id}`)
      history.replaceState(null, "", `#champion-${c.id}`);
  }

  async function open(id) {
    try {
      await load();
    } catch {
      return false; // no data: the link just stays on the roster
    }
    const i = data.findIndex((c) => c.id === id);
    if (i < 0) return false;
    render(i);
    if (!dialog.open) {
      dialog.showModal();
      root.classList.add("panel-open");
    }
    $("#champ-tabs [aria-selected=true]")?.focus({ preventScroll: true });
    return true;
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-champion]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    void open(a.dataset.champion);
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target.closest("[data-close]")) dialog.close();
    const step = e.target.closest("[data-step]");
    if (step) render(current + Number(step.dataset.step));
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
    if (location.hash.startsWith("#champion-"))
      history.replaceState(null, "", location.pathname + location.search);
    const card = data && $(`[data-champion="${data[current]?.id}"]`);
    card?.focus({ preventScroll: true });
  });
  // A shared link straight to a champion (#champion-voltkit).
  const deep = location.hash.match(/^#champion-([a-z]+)$/);
  if (deep) void open(deep[1]);
})();
