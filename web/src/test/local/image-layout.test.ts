import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_LAYOUT,
  IMAGE_ASPECT,
  VARIANT_SIZE,
  layoutFromLegacy,
} from "@/lib/image-layout";

describe("image-layout constants", () => {
  it("keeps a consistent 3:4 portrait aspect across all variants", () => {
    expect(IMAGE_ASPECT).toBeCloseTo(3 / 4, 5);
    for (const key of ["picto", "petite", "moyenne", "grande"] as const) {
      const { w, h } = VARIANT_SIZE[key];
      expect(w / h).toBeCloseTo(IMAGE_ASPECT, 5);
    }
  });

  it("uses the agreed fixed pixel boxes", () => {
    expect(VARIANT_SIZE.picto).toEqual({ w: 96, h: 128 });
    expect(VARIANT_SIZE.petite).toEqual({ w: 288, h: 384 });
    expect(VARIANT_SIZE.moyenne).toEqual({ w: 576, h: 768 });
    expect(VARIANT_SIZE.grande).toEqual({ w: 1080, h: 1440 });
  });
});

describe("layoutFromLegacy", () => {
  it("returns defaults for empty input", () => {
    const layout = layoutFromLegacy({});
    expect(layout.offsetX).toBeCloseTo(0, 5);
    expect(layout.offsetY).toBeCloseTo(0, 5);
    expect(layout.scaleX).toBe(1);
    expect(layout.scaleY).toBe(1);
    expect(layout.rotation).toBe(0);
    expect(layout.lockAspect).toBe(true);
    expect(layout.cropShape).toBe("RECT");
    expect(layout.backgroundColor).toBe("#000000");
  });

  it("prefers new layout fields over legacy focus/zoom", () => {
    const layout = layoutFromLegacy({
      offsetX: 0.2,
      offsetY: -0.1,
      scaleX: 1.4,
      scaleY: 1.1,
      rotation: 15.5,
      lockAspect: false,
      cropShape: "CIRCLE",
      backgroundColor: "#ffffff",
      cropInset: 0.1,
      focusX: 0.9,
      zoom: 3,
    });
    expect(layout.offsetX).toBe(0.2);
    expect(layout.scaleX).toBe(1.4);
    expect(layout.scaleY).toBe(1.1);
    expect(layout.rotation).toBe(15.5);
    expect(layout.lockAspect).toBe(false);
    expect(layout.cropShape).toBe("CIRCLE");
    expect(layout.backgroundColor).toBe("#ffffff");
    expect(layout.cropInset).toBe(0.1);
  });

  it("maps legacy focus/zoom into approximate offset/scale", () => {
    const layout = layoutFromLegacy({
      focusX: 0.25,
      focusY: 0.75,
      zoom: 2,
      rotation: 90,
    });
    expect(layout.scaleX).toBe(2);
    expect(layout.scaleY).toBe(2);
    expect(layout.rotation).toBe(90);
    expect(layout.offsetX).toBeCloseTo(0.5, 5); // (0.25-0.5)*-2
    expect(layout.offsetY).toBeCloseTo(-0.5, 5);
  });

  it("keeps DEFAULT_IMAGE_LAYOUT stable for identity bake", () => {
    expect(DEFAULT_IMAGE_LAYOUT.cropShape).toBe("RECT");
    expect(DEFAULT_IMAGE_LAYOUT.lockAspect).toBe(true);
    expect(DEFAULT_IMAGE_LAYOUT.scaleX).toBe(1);
  });
});
