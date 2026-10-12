export function stadiumCrowd() {
  const row = Array.from(
    { length: 24 },
    (_, i) =>
      `<span class="spectator" style="--cheer-delay:${-(i % 7) * 0.27}s;--fan-color:${["#ef4f61", "#ffd65b", "#9dc8ff", "#f3f6ff"][i % 4]}"><i></i></span>`,
  ).join("");
  return `<div class="stadium-stands stands-top" aria-hidden="true"><div class="spectators">${row}</div></div><div class="stadium-stands stands-bottom" aria-hidden="true"><div class="spectators">${row}</div></div>`;
}
export function stadiumBands(height: number) {
  return {
    top: Math.max(64, Math.min(72, height * 0.18)),
    bottom: Math.max(32, Math.min(44, height * 0.12)),
  };
}
