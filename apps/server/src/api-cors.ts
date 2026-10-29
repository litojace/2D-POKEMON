import type { RequestHandler } from "express";

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
      res.setHeader("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(origin && origin === clientOrigin ? 204 : 403);
      return;
    }
    next();
  };
}
