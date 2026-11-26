import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The auth emails stay dark even in mail apps that invert colours (Gmail on
// iPhone): every coloured surface is also a gradient (bg-*), and every
// coloured text carries a t-* class that Gmail paints through a gradient
// (supabase/templates/README.md).
const dir = join(__dirname, "../../supabase/templates");
const templates: Record<string, string[]> = {
  "confirm-signup.html": ["ConfirmationURL", "Email"],
  "reset-password.html": ["ConfirmationURL", "Email"],
  "change-email.html": ["ConfirmationURL", "Email", "NewEmail"],
  "reauthentication.html": ["Email", "Token"],
};

const tags = (html: string) =>
  [
    ...html.replace(/<style>[\s\S]*?<\/style>/, "").matchAll(/<[a-z][^>]*>/gi),
  ].map((m) => m[0]);
const styleOf = (tag: string) => /style="([^"]*)"/.exec(tag)?.[1] ?? "";
const classOf = (tag: string) =>
  /class="([^"]*)"/.exec(tag)?.[1].split(/\s+/) ?? [];
const defined = (html: string, prefix: string) =>
  new Set(
    [...html.matchAll(new RegExp(`\\.(${prefix}-[a-z]+)\\b`, "g"))].map(
      (m) => m[1],
    ),
  );

describe("auth email templates", () => {
  for (const [file, vars] of Object.entries(templates)) {
    const html = readFileSync(join(dir, file), "utf8");
    describe(file, () => {
      it("keeps its Supabase variables and only those", () => {
        const used = new Set(
          [...html.matchAll(/\{\{ \.(\w+) \}\}/g)].map((m) => m[1]),
        );
        expect([...used].sort()).toEqual([...vars].sort());
        expect(html).not.toMatch(/src="[^"]*\{\{/);
        expect(html).not.toMatch(/\?[^"]*\{\{/);
      });

      it("declares itself dark and gives Gmail its hook", () => {
        expect(html).toContain('<meta name="color-scheme" content="dark" />');
        expect(html).toMatch(/<body class="body[ "]/);
        expect(html).toContain("u + .body");
      });

      it("loads images only from the game's site", () => {
        for (const m of html.matchAll(/<img[^>]*src="([^"]+)"/g)) {
          expect(m[1]).toMatch(/^https:\/\/play\.elementarenausa\.com\//);
        }
        expect(html).not.toMatch(/url\(/);
      });

      it("backs every coloured surface with a gradient class", () => {
        const bg = defined(html, "bg");
        for (const tag of tags(html)) {
          const color = /background-color:\s*(#[0-9a-f]{6})/i.exec(
            styleOf(tag),
          );
          if (!color) continue;
          const cls = classOf(tag).filter((c) => bg.has(c));
          expect(cls, tag).toHaveLength(1);
          expect(html).toContain(
            `.${cls[0]} { background-image: linear-gradient(${color[1]}, ${color[1]})`,
          );
        }
      });

      it("gives every coloured text a Gmail gradient class of the same colour", () => {
        const t = defined(html, "t");
        for (const tag of tags(html)) {
          const color = /(?:^|;)\s*color:\s*(#[0-9a-f]{6})/i.exec(styleOf(tag));
          if (!color) continue;
          const cls = classOf(tag).filter((c) => t.has(c));
          expect(cls, tag).toHaveLength(1);
          expect(html).toContain(
            `u + .body .${cls[0]} { background-image: linear-gradient(${color[1]}, ${color[1]}); }`,
          );
        }
      });

      it("draws no borders, which inverting apps would recolour", () => {
        for (const tag of tags(html))
          expect(styleOf(tag), tag).not.toMatch(/(^|;)\s*border(-top)?:\s*1px/);
      });
    });
  }
});
