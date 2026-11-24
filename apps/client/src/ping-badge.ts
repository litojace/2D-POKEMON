/**
 * The in-battle ping badge: a small pill by the settings gear showing the
 * round trip to the server, green under 80 ms, amber under 150 ms, red
 * above. Players can tell network lag from the game, and predicted casts
 * use the same number to know how long to wait for the server.
 */
export type PingLevel = "good" | "fair" | "poor";
export function pingLevel(ms: number): PingLevel {
  return ms < 80 ? "good" : ms < 150 ? "fair" : "poor";
}
/** Smooth samples so one slow packet does not flash red. */
export function smoothPing(previous: number | undefined, sample: number) {
  return previous === undefined ? sample : previous * 0.7 + sample * 0.3;
}

interface PingSocket {
  connected: boolean;
  timeout(ms: number): {
    emit(event: string, data: unknown, cb: (err: unknown) => void): void;
  };
}
export function startPingBadge(
  socket: PingSocket,
  /** Is a battle on screen (and where the badge sits). */
  host: () => HTMLElement | null,
  onPing: (ms: number) => void,
  every = 2000,
) {
  let ping: number | undefined;
  let badge: HTMLElement | undefined;
  const measure = () => {
    const at = host();
    if (!at || !socket.connected) {
      badge?.remove();
      badge = undefined;
      return;
    }
    const start = performance.now();
    socket.timeout(2000).emit("rtt", {}, (err) => {
      if (err) return;
      ping = smoothPing(ping, performance.now() - start);
      onPing(ping);
      const place = host();
      if (!place) return;
      if (!badge || !badge.isConnected || badge.parentElement !== place) {
        badge?.remove();
        badge = document.createElement("span");
        badge.className = "ping-badge";
        badge.setAttribute("aria-hidden", "true");
        place.append(badge);
      }
      const ms = Math.round(ping);
      const level = pingLevel(ms);
      const text = `${ms} ms`;
      if (badge.textContent !== text) badge.textContent = text;
      badge.dataset.level = level;
      badge.title = `Ping ${ms} ms (${level === "good" ? "smooth" : level === "fair" ? "a little delay" : "laggy connection"})`;
    });
  };
  measure();
  const timer = setInterval(measure, every);
  return () => {
    clearInterval(timer);
    badge?.remove();
  };
}
