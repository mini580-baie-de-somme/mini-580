import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_LAYOUT,
  IMAGE_ASPECT,
  VARIANT_SIZE,
  computeEditorCropWindow,
  computeEditorPhotoLayout,
  cropCircleMetrics,
  cropWindowFractions,
  layoutFromLegacy,
  legacyFieldsFromLayout,
  mergeLayoutPatch,
  layoutForRebake,
  offsetForScalePivot,
  rotatedImageBounds,
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
  it("uses post-rotation bounds for cover scale (matches rebake pipeline)", () => {
    const stageW = 360;
    const stageH = 480;
    const iw = 800;
    const ih = 600;

    const flat = computeEditorPhotoLayout({
      layout: { ...DEFAULT_IMAGE_LAYOUT, rotation: 0 },
      stageWidth: stageW,
      stageHeight: stageH,
      imageWidth: iw,
      imageHeight: ih,
    });
    const tilted = computeEditorPhotoLayout({
      layout: { ...DEFAULT_IMAGE_LAYOUT, rotation: 45 },
      stageWidth: stageW,
      stageHeight: stageH,
      imageWidth: iw,
      imageHeight: ih,
    });

    const bounds45 = rotatedImageBounds(iw, ih, 45);
    const { cropW, cropH } = computeEditorCropWindow(
      DEFAULT_IMAGE_LAYOUT.cropInset,
      stageW,
      stageH
    );
    const expectedCover = Math.max(cropW / bounds45.width, cropH / bounds45.height);
    expect(tilted.width).toBeCloseTo(bounds45.width * expectedCover, 3);
    expect(tilted.height).toBeCloseTo(bounds45.height * expectedCover, 3);
    // Rotation must change layout — not equivalent to 0° with raw iw/ih
    expect(tilted.width).not.toBeCloseTo(flat.width, 1);
    expect(rotatedImageBounds(iw, ih, 90).width).toBeCloseTo(ih, 5);
    expect(rotatedImageBounds(iw, ih, 90).height).toBeCloseTo(iw, 5);
  });

  it("matches server draw size formula at 0° (pre-rotation iw/ih)", () => {
    const iw = 800;
    const ih = 600;
    const stageW = 360;
    const stageH = 480;
    const { cropW, cropH } = computeEditorCropWindow(
      DEFAULT_IMAGE_LAYOUT.cropInset,
      stageW,
      stageH
    );
    const coverScale = Math.max(cropW / iw, cropH / ih);
    const layout = computeEditorPhotoLayout({
      layout: DEFAULT_IMAGE_LAYOUT,
      stageWidth: stageW,
      stageHeight: stageH,
      imageWidth: iw,
      imageHeight: ih,
    });
    expect(layout.width).toBeCloseTo(iw * coverScale, 3);
    expect(layout.height).toBeCloseTo(ih * coverScale, 3);
  });

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
  it("scales crop with stage size while preserving 3:4 ratio", () => {
    const inset = DEFAULT_IMAGE_LAYOUT.cropInset;
    const small = computeEditorCropWindow(inset, 320, 320 / IMAGE_ASPECT);
    const large = computeEditorCropWindow(inset, 400, 400 / IMAGE_ASPECT);

    const ratio = 1 - 2 * inset;
    expect(small.cropW / small.cropH).toBeCloseTo(IMAGE_ASPECT, 5);
    expect(large.cropW / large.cropH).toBeCloseTo(IMAGE_ASPECT, 5);
    expect(large.cropW / small.cropW).toBeCloseTo(400 / 320, 5);
    expect(large.cropH / small.cropH).toBeCloseTo(400 / 320, 5);
    expect(small.cropW).toBeCloseTo(320 * ratio, 5);
    expect(small.cropH).toBeCloseTo((320 / IMAGE_ASPECT) * ratio, 5);
  });

  it("uses equal fractional inset on all stage edges", () => {
    const inset = DEFAULT_IMAGE_LAYOUT.cropInset;
    const stageW = 360;
    const stageH = stageW / IMAGE_ASPECT;
    const win = computeEditorCropWindow(inset, stageW, stageH);
    expect(win.refLeft).toBe(0);
    expect(win.refTop).toBe(0);
    expect(win.refW).toBeCloseTo(stageW, 5);
    expect(win.refH).toBeCloseTo(stageH, 5);
    expect(win.cropLeft).toBeCloseTo(stageW * inset, 5);
    expect(win.cropTop).toBeCloseTo(stageH * inset, 5);
    expect(win.cropW).toBeCloseTo(stageW * (1 - 2 * inset), 5);
    expect(win.cropH).toBeCloseTo(stageH * (1 - 2 * inset), 5);
  });
});

describe("cropCircleMetrics", () => {
  it("inscribes a true circle in the 3:4 crop window", () => {
    const win = computeEditorCropWindow(DEFAULT_IMAGE_LAYOUT.cropInset, 360, 480);
    const circle = cropCircleMetrics(win);
    expect(circle.size).toBeCloseTo(Math.min(win.cropW, win.cropH), 5);
    expect(circle.r).toBeCloseTo(circle.size / 2, 5);
    expect(circle.cx).toBeCloseTo(win.cropLeft + win.cropW / 2, 5);
    expect(circle.cy).toBeCloseTo(win.cropTop + win.cropH / 2, 5);
    expect(circle.left + circle.size / 2).toBeCloseTo(circle.cx, 5);
    expect(circle.top + circle.size / 2).toBeCloseTo(circle.cy, 5);
  });

  it("uses crop width as diameter on portrait 3:4 stages (shorter side)", () => {
    const stageW = 300;
    const stageH = stageW / IMAGE_ASPECT;
    const win = computeEditorCropWindow(0.06, stageW, stageH);
    const circle = cropCircleMetrics(win);
    expect(win.cropW).toBeLessThan(win.cropH);
    expect(circle.size).toBeCloseTo(win.cropW, 5);
    expect(circle.top).toBeGreaterThan(win.cropTop);
    expect(circle.top + circle.size).toBeLessThan(win.cropTop + win.cropH);
  });
});

describe("offsetForScalePivot", () => {
  it("scales offset with uniform zoom to keep crop center pinned", () => {
    const next = offsetForScalePivot(0.4, -0.2, 1, 1, 2, 2);
    expect(next.offsetX).toBeCloseTo(0.8, 5);
    expect(next.offsetY).toBeCloseTo(-0.4, 5);
  });

  it("scales each offset axis independently when aspect is unlocked", () => {
    const next = offsetForScalePivot(0.3, 0.6, 1, 2, 1.5, 3);
    expect(next.offsetX).toBeCloseTo(0.45, 5);
    expect(next.offsetY).toBeCloseTo(0.9, 5);
  });

  it("leaves offset unchanged when scale is unchanged", () => {
    expect(offsetForScalePivot(0.25, -0.1, 1.5, 2, 1.5, 2)).toEqual({
      offsetX: 0.25,
      offsetY: -0.1,
    });
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

  it("mergeLayoutPatch overlays patch onto stored legacy fields", () => {
    const merged = mergeLayoutPatch(
      {
        offsetX: 0.1,
        scaleX: 1.5,
        scaleY: 1.5,
        zoom: 1,
        focusX: 0.5,
        focusY: 0.5,
        rotation: 10,
        cropShape: "RECT",
      },
      { cropShape: "CIRCLE", rotation: 25, scaleX: 2 }
    );
    expect(merged.cropShape).toBe("CIRCLE");
    expect(merged.rotation).toBe(25);
    expect(merged.scaleX).toBe(2);
    expect(merged.offsetX).toBeCloseTo(0.1, 5);
  });

  it("layoutForRebake with empty patch uses persisted scaleX over stale zoom", () => {
    const persisted = {
      offsetX: 0.12,
      offsetY: -0.05,
      scaleX: 1.85,
      scaleY: 1.85,
      zoom: 1,
      focusX: 0.5,
      focusY: 0.5,
      rotation: 40,
      lockAspect: true,
      cropShape: "RECT",
      backgroundColor: "#000000",
      cropInset: 0.06,
    };
    const rebaked = layoutForRebake(persisted, {});
    expect(rebaked.scaleX).toBeCloseTo(1.85, 5);
    expect(rebaked.rotation).toBe(40);
    expect(rebaked.offsetX).toBeCloseTo(0.12, 5);
  });
});
