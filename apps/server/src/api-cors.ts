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

/** The static frontend uses bearer tokens, not cross-site cookies. */
export function apiCors(clientOrigin?: string): RequestHandler {
  return (req, res, next) => {
    const origin = req.get("origin");
    res.vary("Origin");
    if (origin && origin === clientOrigin) {
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
      res.sendStatus(origin && origin === clientOrigin ? 204 : 403);
      return;
    }
    next();
  };
}
