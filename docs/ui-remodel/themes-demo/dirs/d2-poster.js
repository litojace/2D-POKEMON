(() => {
  const layer = document.querySelector(".lobby-layer");
  const fig = document.getElementById("lobby-fighter");
  document.documentElement.style.setProperty("--el", fig.style.getPropertyValue("--element") || "#ffd65b");
  const name = document.getElementById("lobby-fighter-name").textContent;
  const bd = layer.querySelector(".lobby-backdrop");
  bd.insertAdjacentHTML("beforeend", `<div class="d2-bigname is-echo">${name}</div><div class="d2-slab"></div><div class="d2-stripe"></div>`);
})();
