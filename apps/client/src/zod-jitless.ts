/**
 * Zod compiles fast parsers with `new Function` when it may, and finds out by
 * trying once. The game's Content-Security-Policy allows no eval
 * (docs/static-frontend.md, "Security headers"), so that try would be a
 * logged violation on every start. Jitless mode skips the try and the
 * compiled parsers; the client's messages are small, so parsing stays quick.
 * Imported first by main.ts, before any schema parses.
 */
import { z } from "zod";

z.config({ jitless: true });
