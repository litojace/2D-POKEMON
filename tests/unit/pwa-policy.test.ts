import { expect, it } from "vitest";
import { typingIn } from "../../apps/client/src/pwa-policy";

it("counts text fields as typing, not buttons, checkboxes or sliders", () => {
  expect(typingIn({ tagName: "INPUT", type: "text" })).toBe(true);
  expect(typingIn({ tagName: "input", type: "search" })).toBe(true);
  expect(typingIn({ tagName: "INPUT", type: "" })).toBe(true);
  expect(typingIn({ tagName: "TEXTAREA" })).toBe(true);
  expect(typingIn({ tagName: "DIV", isContentEditable: true })).toBe(true);
  expect(typingIn({ tagName: "INPUT", type: "checkbox" })).toBe(false);
  expect(typingIn({ tagName: "INPUT", type: "range" })).toBe(false);
  expect(typingIn({ tagName: "BUTTON", type: "submit" })).toBe(false);
  expect(typingIn({ tagName: "BODY" })).toBe(false);
  expect(typingIn(null)).toBe(false);
});
