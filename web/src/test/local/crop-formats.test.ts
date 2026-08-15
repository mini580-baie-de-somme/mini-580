import { describe, expect, it } from "vitest";
import {
  CROP_ASPECT_FORMATS,
  DEFAULT_IMAGE_LAYOUT,
  defaultCropShapeForFormat,
  editorStageStyleForFormat,
  imageAspectForFormat,
  resolveCropAspectFormat,
  variantSizesForFormat,
} from "@/lib/image-layout";

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

  it("builds fillStage styles that preserve landscape 16:9 inside a bounded parent", () => {
    const style = editorStageStyleForFormat("LANDSCAPE_16_9", { fillStage: true });
    expect(style.aspectRatio).toBe(String(16 / 9));
    expect(style.width).toBe("100%");
    expect(style.height).toBe("auto");
    expect(style.maxHeight).toBe("100%");
  });

  it("builds fillStage styles that preserve portrait 3:4 inside a bounded parent", () => {
    const style = editorStageStyleForFormat("PORTRAIT_3_4", { fillStage: true });
    expect(style.aspectRatio).toBe(String(3 / 4));
    expect(style.height).toBe("100%");
    expect(style.width).toBe("auto");
    expect(style.maxWidth).toBe("100%");
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
      layout: {
        ...prev.layout,
        cropShape: defaultCropShapeForFormat(nextFormat),
      },
    };
    expect(merged.cropAspectFormat).toBe("LANDSCAPE_16_9");
    expect(imageAspectForFormat(merged.cropAspectFormat)).toBeCloseTo(16 / 9, 5);
    expect(merged.layout.cropShape).toBe("RECT");
  });
});
