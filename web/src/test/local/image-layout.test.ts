import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_LAYOUT,
  EDITOR_REFERENCE_SIZE,
  IMAGE_ASPECT,
  VARIANT_SIZE,
  computeEditorCropWindow,
  computeEditorPhotoLayout,
  cropWindowFractions,
  layoutFromLegacy,
  legacyFieldsFromLayout,
  mergeLayoutPatch,
  layoutForRebake,
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

describe("computeEditorPhotoLayout", () => {
  it("preserves source aspect ratio when lockAspect zooms uniformly", () => {
    const stageW = 360;
    const stageH = 480;
    const iw = 800;
    const ih = 600;

    const at1 = computeEditorPhotoLayout({
      layout: DEFAULT_IMAGE_LAYOUT,
      stageWidth: stageW,
      stageHeight: stageH,
      imageWidth: iw,
      imageHeight: ih,
    });
    const at2 = computeEditorPhotoLayout({
      layout: { ...DEFAULT_IMAGE_LAYOUT, scaleX: 2, scaleY: 2 },
      stageWidth: stageW,
      stageHeight: stageH,
      imageWidth: iw,
      imageHeight: ih,
    });

    expect(at1.width / at1.height).toBeCloseTo(iw / ih, 5);
    expect(at2.width / at2.height).toBeCloseTo(iw / ih, 5);
    expect(at2.width / at1.width).toBeCloseTo(2, 5);
    expect(at2.height / at1.height).toBeCloseTo(2, 5);
  });

  it("keeps crop window fractions stable regardless of scale", () => {
    const { cropW, cropH } = cropWindowFractions(DEFAULT_IMAGE_LAYOUT.cropInset);
    expect(cropW).toBeCloseTo(0.88, 5);
    expect(cropH).toBeCloseTo(0.88, 5);
    expect(cropW / cropH).toBeCloseTo(IMAGE_ASPECT / IMAGE_ASPECT, 5);
  });
});

describe("computeEditorCropWindow", () => {
  it("keeps crop pixel size and 3:4 ratio when the stage resizes", () => {
    const inset = DEFAULT_IMAGE_LAYOUT.cropInset;
    const small = computeEditorCropWindow(inset, 320, 520);
    const large = computeEditorCropWindow(inset, 400, 680);

    expect(small.cropW).toBeCloseTo(large.cropW, 5);
    expect(small.cropH).toBeCloseTo(large.cropH, 5);
    expect(small.cropW / small.cropH).toBeCloseTo(IMAGE_ASPECT, 5);

    const expectedW = EDITOR_REFERENCE_SIZE.w * (1 - 2 * inset);
    const expectedH = EDITOR_REFERENCE_SIZE.h * (1 - 2 * inset);
    expect(small.cropW).toBeCloseTo(expectedW, 5);
    expect(small.cropH).toBeCloseTo(expectedH, 5);
  });

  it("centers the fixed reference canvas within the live stage", () => {
    const win = computeEditorCropWindow(DEFAULT_IMAGE_LAYOUT.cropInset, 360, 600);
    expect(win.refLeft).toBeCloseTo((360 - EDITOR_REFERENCE_SIZE.w) / 2, 5);
    expect(win.refTop).toBeCloseTo((600 - EDITOR_REFERENCE_SIZE.h) / 2, 5);
    expect(win.cropLeft).toBeGreaterThanOrEqual(win.refLeft);
    expect(win.cropTop).toBeGreaterThanOrEqual(win.refTop);
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

  it("falls back to legacy zoom when scaleX is still at default", () => {
    const layout = layoutFromLegacy({
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
      zoom: 1.85,
      focusX: 0.5,
      focusY: 0.5,
    });
    expect(layout.scaleX).toBeCloseTo(1.85, 5);
    expect(layout.scaleY).toBeCloseTo(1.85, 5);
  });

  it("syncs legacy focus into offset when offset is still default", () => {
    const layout = layoutFromLegacy({
      scaleX: 1.2,
      offsetX: 0,
      offsetY: 0,
      focusX: 0.25,
      focusY: 0.75,
      zoom: 1.2,
    });
    expect(layout.offsetX).toBeCloseTo(0.5, 5);
    expect(layout.offsetY).toBeCloseTo(-0.5, 5);
  });

  it("legacyFieldsFromLayout mirrors layoutFromLegacy", () => {
    const layout = {
      offsetX: 0.22,
      offsetY: -0.15,
      scaleX: 1.85,
      scaleY: 1.85,
      rotation: 45,
      lockAspect: true,
      cropShape: "RECT" as const,
      backgroundColor: "#000000",
      cropInset: 0.06,
    };
    const legacy = legacyFieldsFromLayout(layout);
    const roundTrip = layoutFromLegacy({
      ...legacy,
      ...layout,
    });
    expect(roundTrip.scaleX).toBeCloseTo(1.85, 5);
    expect(roundTrip.offsetX).toBeCloseTo(0.22, 5);
    expect(roundTrip.rotation).toBe(45);
  });

  it("keeps DEFAULT_IMAGE_LAYOUT stable for identity bake", () => {
    expect(DEFAULT_IMAGE_LAYOUT.cropShape).toBe("RECT");
    expect(DEFAULT_IMAGE_LAYOUT.lockAspect).toBe(true);
    expect(DEFAULT_IMAGE_LAYOUT.scaleX).toBe(1);
  });

  it("layoutForRebake prefers explicit patch over stale legacy zoom/focus", () => {
    const existing = {
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1,
      zoom: 1,
      focusX: 0.5,
      focusY: 0.5,
    };
    const rebaked = layoutForRebake(existing, {
      offsetX: 0.25,
      scaleX: 2.1,
      rotation: 30,
    });
    expect(rebaked.offsetX).toBeCloseTo(0.25, 5);
    expect(rebaked.scaleX).toBeCloseTo(2.1, 5);
    expect(rebaked.rotation).toBe(30);
  });
});
