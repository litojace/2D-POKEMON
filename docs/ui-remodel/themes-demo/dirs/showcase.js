(() => {
  const fig = document.getElementById("lobby-fighter");
  document.documentElement.style.setProperty("--el", fig.style.getPropertyValue("--element") || "#ffd65b");
  const cards = document.querySelector(".lobby-cards");
  cards.insertAdjacentHTML("afterbegin", `<button type="button" class="lobby-card d4-raid" data-lobby-action="raids"><span class="d4-raid-art"></span><span class="lobby-card-kicker">Raid</span><b>Cragmuff</b><small>Team up against a boss</small></button>`);
  const bd = document.querySelector(".lobby-backdrop");
  bd.insertAdjacentHTML("beforeend", `<div class="d4-glow"></div><div class="d4-floorline"></div>`);
})();
