import { expect, it, vi } from "vitest";
import { updateMenuShell } from "../../apps/client/src/menu-shell";

it("keeps the home screen mounted while its Play panel changes", () => {
  const home = { scrollLeft: 370 };
  const panel = { innerHTML: "home" };
  const menu = {
    hidden: false,
    innerHTML: "original shell",
    querySelector: (selector: string) =>
      selector === ".room-panel" ? panel : home,
  } as unknown as HTMLElement;
  const build = vi.fn(() => "rebuilt shell");
  for (const content of ["play", "a mode picked", "home"]) {
    expect(updateMenuShell(menu, content, build)).toBe(true);
    expect(panel.innerHTML).toBe(content);
    expect(menu.innerHTML).toBe("original shell");
    expect(menu.querySelector(".home-screen")).toBe(home);
    expect(home.scrollLeft).toBe(370);
  }
  expect(build).not.toHaveBeenCalled();
});
it("builds the shell when first opening the menu or returning from battle", () => {
  const menu = {
    hidden: true,
    innerHTML: "",
    querySelector: () => null,
  } as unknown as HTMLElement;
  const build = vi.fn(() => "fresh shell");
  expect(updateMenuShell(menu, "home", build)).toBe(false);
  expect(menu.innerHTML).toBe("fresh shell");
  expect(build).toHaveBeenCalledOnce();
});
