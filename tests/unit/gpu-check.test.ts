import { describe, expect, it } from "vitest";
import { classifyRenderer } from "../../apps/client/src/gpu-check";
import { autoChoosesLow } from "../../apps/client/src/graphics-quality";

// A school or office PC whose browser draws without its graphics card lags
// even with a fast processor: Graphics Auto starts Low there.
describe("software rendering", () => {
  it("knows the CPU rasterizers by name", () => {
    for (const name of [
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
      "Google SwiftShader",
      "ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)",
      "llvmpipe (LLVM 15.0.7, 256 bits)",
    ])
      expect(classifyRenderer(name, false).software).toBe(true);
  });
  it("leaves real graphics cards alone", () => {
    for (const name of [
      "ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E92) Direct3D11 vs_5_0 ps_5_0, D3D11)",
      "ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Direct3D11 vs_5_0 ps_5_0, D3D11)",
      "Apple GPU",
      "Mali-G57",
      "",
    ])
      expect(classifyRenderer(name, false).software).toBe(false);
  });
  it("a refused performance-caveat context, or no WebGL at all, is the CPU too", () => {
    expect(classifyRenderer("WebKit WebGL", true).software).toBe(true);
    expect(classifyRenderer(null, false).software).toBe(true);
  });
  it("makes Graphics Auto start Low, whatever the memory", () => {
    (globalThis as any).localStorage = {
      getItem: () => null,
      setItem() {},
      removeItem() {},
    };
    expect(autoChoosesLow(16, () => true)).toBe(true);
    expect(autoChoosesLow(16, () => false)).toBe(false);
  });
});
