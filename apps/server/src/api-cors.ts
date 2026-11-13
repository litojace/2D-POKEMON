import type { RequestHandler } from "express";
import { SERVER_TIME_HEADER } from "../../../packages/shared/src/accounts.js";

/**
 * Stamp each API answer with the server's clock. Daily picks, missions, the
 * Daily Spark and weekly goals reset on server time (the Pacific day), so
 * the hub's countdowns follow this clock, never the device's.
 */
export function apiClock(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader(SERVER_TIME_HEADER, String(Date.now()));
    next();
  };
}

/** Where the iPhone app's pages come from (Capacitor's iOS scheme). */
export const NATIVE_APP_ORIGIN = "capacitor://localhost";
/**
 * The other sites allowed to call the API and open the game socket:
 * CLIENT_ORIGIN (one origin, or several separated by commas), plus the
 * iPhone app. Allowing an origin grants nothing by itself: every request
 * still needs the player's login token in a header, and no cookies are
 * used, so another page can't act for a player.
 */
export function clientOrigins(
  value = process.env.CLIENT_ORIGIN,
): readonly string[] {
  const list = (value ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return [...new Set([...list, NATIVE_APP_ORIGIN])];
}

/** The static frontend uses bearer tokens, not cross-site cookies. */
export function apiCors(
  allowed: readonly string[] = clientOrigins(),
): RequestHandler {
  return (req, res, next) => {
    const origin = req.get("origin");
    res.vary("Origin");
    const ok = !!origin && allowed.includes(origin);
    if (ok) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      // The client reads the server's clock from every API answer
      // (apiClock below), so its countdowns don't trust the device clock.
      res.setHeader("Access-Control-Expose-Headers", SERVER_TIME_HEADER);
      res.setHeader("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(ok ? 204 : 403);
      return;
    }
    next();
  };
}
