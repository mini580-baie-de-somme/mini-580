import { describe, expect, it } from "vitest";
import {
  CROP_ASPECT_FORMATS,
  DEFAULT_IMAGE_LAYOUT,
  containStageSize,
  defaultCropShapeForFormat,
  editorStageStyleForFormat,
  imageAspectForFormat,
  layoutForCropFormatChange,
  legacyFieldsFromLayout,
  resolveCropAspectFormat,
  variantSizesForFormat,
} from "@/lib/image-layout";
import { COVER_DEFAULT_CROP_FORMAT } from "@/lib/cover-display";

describe("crop aspect formats", () => {
  it("exposes all five supported formats", () => {
    expect(CROP_ASPECT_FORMATS).toEqual([
      "SQUARE",
      "LANDSCAPE_16_9",
      "LANDSCAPE_4_3",
      "PORTRAIT_3_4",
      "CIRCLE",
    ]);
  });

  it("defaults unknown values to portrait 3:4 for legacy media", () => {
    expect(resolveCropAspectFormat(null)).toBe("PORTRAIT_3_4");
    expect(resolveCropAspectFormat("INVALID")).toBe("PORTRAIT_3_4");
    expect(resolveCropAspectFormat("SQUARE")).toBe("SQUARE");
  });

  it("maps circle format to circle crop shape", () => {
    expect(defaultCropShapeForFormat("CIRCLE")).toBe("CIRCLE");
    expect(defaultCropShapeForFormat("SQUARE")).toBe("RECT");
  });

  it("computes expected aspect ratios", () => {
    expect(imageAspectForFormat("SQUARE")).toBe(1);
    expect(imageAspectForFormat("CIRCLE")).toBe(1);
    expect(imageAspectForFormat("LANDSCAPE_16_9")).toBeCloseTo(16 / 9, 5);
    expect(imageAspectForFormat("LANDSCAPE_4_3")).toBeCloseTo(4 / 3, 5);
    expect(imageAspectForFormat("PORTRAIT_3_4")).toBeCloseTo(3 / 4, 5);
  });

  it("builds variant boxes with long edge and correct aspect", () => {
    for (const format of CROP_ASPECT_FORMATS) {
      const sizes = variantSizesForFormat(format);
      const aspect = imageAspectForFormat(format);
      for (const key of ["picto", "petite", "moyenne", "grande"] as const) {
        const { w, h } = sizes[key];
        expect(w).toBeGreaterThan(0);
        expect(h).toBeGreaterThan(0);
        expect(w / h).toBeCloseTo(aspect, 2);
      }
      expect(sizes.grande.w).toBeGreaterThan(sizes.moyenne.w);
      expect(sizes.moyenne.w).toBeGreaterThan(sizes.petite.w);
      expect(sizes.petite.w).toBeGreaterThan(sizes.picto.w);
    }
  });

  it("square grande uses 1440 edge (new upload default format)", () => {
    const square = variantSizesForFormat("SQUARE").grande;
    expect(square).toEqual({ w: 1440, h: 1440 });
  });

  it("containStageSize keeps true aspect inside a wide+short parent (cover fillStage)", () => {
    // Modal workspace: wide and short — the old CSS width:100% + height:auto broke here.
    const parentW = 900;
    const parentH = 320;
    const aspect = imageAspectForFormat("LANDSCAPE_16_9");
    const stage = containStageSize(parentW, parentH, aspect);
    expect(stage.width).toBeGreaterThan(0);
    expect(stage.height).toBeGreaterThan(0);
    expect(stage.width / stage.height).toBeCloseTo(aspect, 2);
    expect(stage.width).toBeLessThanOrEqual(parentW);
    expect(stage.height).toBeLessThanOrEqual(parentH);
    // Height-constrained: 320 tall → width ≈ 320 * 16/9
    expect(stage.height).toBe(parentH);
    expect(stage.width).toBe(Math.round(parentH * aspect));
  });

  it("containStageSize keeps portrait aspect inside a tall+narrow parent", () => {
    const parentW = 280;
    const parentH = 700;
    const aspect = imageAspectForFormat("PORTRAIT_3_4");
    const stage = containStageSize(parentW, parentH, aspect);
    expect(stage.width / stage.height).toBeCloseTo(aspect, 2);
    expect(stage.width).toBe(parentW);
    expect(stage.height).toBe(Math.round(parentW / aspect));
  });

  it("containStageSize clears to 0×0 when parent is unmeasurable", () => {
    expect(containStageSize(0, 400, 16 / 9)).toEqual({ width: 0, height: 0 });
    expect(containStageSize(400, 0, 16 / 9)).toEqual({ width: 0, height: 0 });
    expect(containStageSize(-1, 200, 1)).toEqual({ width: 0, height: 0 });
  });

  it("fillStage CSS style no longer uses asymmetric width/height %/auto hack", () => {
    const landscape = editorStageStyleForFormat("LANDSCAPE_16_9", {
      fillStage: true,
    });
    expect(landscape.aspectRatio).toBe(String(16 / 9));
    expect(landscape.maxWidth).toBe("100%");
    expect(landscape.maxHeight).toBe("100%");
    // Pixel size comes from containStageSize — not width:100% / height:auto.
    expect(landscape.width).toBeUndefined();
    expect(landscape.height).toBeUndefined();

    const portrait = editorStageStyleForFormat("PORTRAIT_3_4", {
      fillStage: true,
    });
    expect(portrait.aspectRatio).toBe(String(3 / 4));
    expect(portrait.width).toBeUndefined();
    expect(portrait.height).toBeUndefined();
  });

  it("format switch keeps pan/zoom offsets (no silent zero)", () => {
    const prev = {
      ...DEFAULT_IMAGE_LAYOUT,
      offsetX: 0.35,
      offsetY: -0.2,
      scaleX: 1.6,
      scaleY: 1.6,
      cropShape: "RECT" as const,
    };
    const next = layoutForCropFormatChange(prev, "LANDSCAPE_16_9");
    expect(next.offsetX).toBeCloseTo(0.35, 5);
    expect(next.offsetY).toBeCloseTo(-0.2, 5);
    expect(next.scaleX).toBeCloseTo(1.6, 5);
    expect(next.cropShape).toBe("RECT");
  });

  it("atomic crop format change keeps aspect + shape in sync (split editor regression)", () => {
    const prev = {
      layout: { ...DEFAULT_IMAGE_LAYOUT },
      cropAspectFormat: "PORTRAIT_3_4" as const,
    };
    const nextFormat = "LANDSCAPE_16_9" as const;
    const merged = {
      ...prev,
      cropAspectFormat: nextFormat,
      layout: layoutForCropFormatChange(prev.layout, nextFormat),
    };
    expect(merged.cropAspectFormat).toBe("LANDSCAPE_16_9");
    expect(imageAspectForFormat(merged.cropAspectFormat)).toBeCloseTo(16 / 9, 5);
    expect(merged.layout.cropShape).toBe("RECT");
  });

  it("cover → 16:9 → pan/zoom → PATCH payload round-trips with ~16:9 stage", () => {
    expect(COVER_DEFAULT_CROP_FORMAT).toBe("LANDSCAPE_16_9");
    const aspect = imageAspectForFormat(COVER_DEFAULT_CROP_FORMAT);
    const stage = containStageSize(960, 360, aspect);
    expect(stage.width / stage.height).toBeCloseTo(16 / 9, 2);

    const layout = {
      ...DEFAULT_IMAGE_LAYOUT,
      offsetX: 0.28,
      offsetY: -0.15,
      scaleX: 1.45,
      scaleY: 1.45,
      rotation: 5,
    };
    const legacy = legacyFieldsFromLayout(layout);
    const patchBody = {
      ...layout,
      ...legacy,
      cropAspectFormat: COVER_DEFAULT_CROP_FORMAT,
    };

    expect(patchBody.cropAspectFormat).toBe("LANDSCAPE_16_9");
    expect(patchBody.offsetX).toBeCloseTo(0.28, 5);
    expect(patchBody.offsetY).toBeCloseTo(-0.15, 5);
    expect(patchBody.scaleX).toBeCloseTo(1.45, 5);
    expect(patchBody.zoom).toBeCloseTo(1.45, 5);
    expect(patchBody.focusX).toBeCloseTo(0.5 - 0.28 / 2, 5);
    expect(patchBody.focusY).toBeCloseTo(0.5 - -0.15 / 2, 5);
    // Stage geometry used by editor gestures stays 16:9 (not stale 3:4).
    expect(stage.width / stage.height).toBeCloseTo(
      imageAspectForFormat("LANDSCAPE_16_9"),
      2
    );
  });
});
