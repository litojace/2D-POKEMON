import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";

/**
 * Portrait frame art as files in apps/client/src/frames/, which the frame
 * stylesheets name with url(). As data URIs inside the stylesheets they were
 * 365 kB of the CSS every start downloads before it can draw anything (38%
 * of it compressed, 26 Nov 2026); as files, a frame downloads when something
 * shows it, and the service worker installs them all once the game has
 * started (vite.config.ts). Each generator owns the files under its prefix
 * and removes the ones it no longer writes (`done`).
 */
export function frameFiles(prefix) {
  const dir = new URL("../apps/client/src/frames/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  const written = new Set();
  return {
    /** Write one picture; its url() for the stylesheet next to frames/. */
    url(name, svg) {
      const file = `${prefix}-${name}.svg`;
      if (written.has(file))
        throw new Error(`Two frame pictures named ${file}`);
      written.add(file);
      writeFileSync(new URL(file, dir), `${svg.replace(/\s+/g, " ").trim()}\n`);
      return `url("./frames/${file}")`;
    },
    done() {
      for (const file of readdirSync(dir))
        if (file.startsWith(`${prefix}-`) && !written.has(file))
          rmSync(new URL(file, dir));
    },
  };
}
