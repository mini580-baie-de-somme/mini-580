/** Shared image layout — client + server safe (no Node imports). */

export const IMAGE_ASPECT = 3 / 4; // width / height — mobile-first portrait

/** Fixed output boxes — same 3:4 aspect for every variant. */
export const VARIANT_SIZE = {
  picto: { w: 96, h: 128 },
  petite: { w: 288, h: 384 },
  moyenne: { w: 576, h: 768 },
  grande: { w: 1080, h: 1440 },
} as const;

export type VariantKey = keyof typeof VARIANT_SIZE;

export type CropShape = "RECT" | "CIRCLE";

export type ImageLayoutParams = {
  /** Photo center offset from canvas center, in canvas-width units (−2…2). */
  offsetX: number;
  offsetY: number;
  /** Uniform / X scale relative to “cover canvas” (1 ≈ cover). */
  scaleX: number;
  scaleY: number;
  /** Free rotation in degrees. */
  rotation: number;
  /** Keep scaleX === scaleY when adjusting “general” scale. */
  lockAspect: boolean;
  cropShape: CropShape;
  /** CSS color or "transparent". */
  backgroundColor: string;
  /**
   * Inset of the crop window from each canvas edge (0–0.4).
   * Output is the crop window, scaled to each variant size.
   */
  cropInset: number;
};

export const DEFAULT_IMAGE_LAYOUT: ImageLayoutParams = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  lockAspect: true,
  cropShape: "RECT",
  backgroundColor: "#000000",
  cropInset: 0.06,
};

export const BACKGROUND_PRESETS: { id: string; value: string; labelFr: string; labelEn: string }[] =
  [
    { id: "transparent", value: "transparent", labelFr: "Transparent", labelEn: "Transparent" },
    { id: "black", value: "#000000", labelFr: "Noir", labelEn: "Black" },
    { id: "darkGray", value: "#374151", labelFr: "Gris foncé", labelEn: "Dark gray" },
    { id: "lightGray", value: "#e5e7eb", labelFr: "Gris clair", labelEn: "Light gray" },
    { id: "white", value: "#ffffff", labelFr: "Blanc", labelEn: "White" },
    { id: "blue", value: "#1e3a5f", labelFr: "Bleu", labelEn: "Blue" },
    { id: "orange", value: "#c2410c", labelFr: "Orange", labelEn: "Orange" },
    { id: "green", value: "#166534", labelFr: "Vert", labelEn: "Green" },
    { id: "red", value: "#991b1b", labelFr: "Rouge", labelEn: "Red" },
  ];

/** Map legacy Media transform fields → layout params. */
export function layoutFromLegacy(raw: {
  focusX?: number | null;
  focusY?: number | null;
  zoom?: number | null;
  rotation?: number | null;
  cropX?: number | null;
  cropY?: number | null;
  cropW?: number | null;
  cropH?: number | null;
  scaleX?: number | null;
  scaleY?: number | null;
  offsetX?: number | null;
  offsetY?: number | null;
  lockAspect?: boolean | null;
  cropShape?: string | null;
  backgroundColor?: string | null;
  cropInset?: number | null;
}): ImageLayoutParams {
  const hasNew =
    raw.scaleX != null ||
    raw.scaleY != null ||
    raw.offsetX != null ||
    raw.offsetY != null;

  if (hasNew) {
    return {
      offsetX: raw.offsetX ?? 0,
      offsetY: raw.offsetY ?? 0,
      scaleX: raw.scaleX ?? raw.zoom ?? 1,
      scaleY: raw.scaleY ?? raw.zoom ?? 1,
      rotation: raw.rotation ?? 0,
      lockAspect: raw.lockAspect ?? true,
      cropShape: raw.cropShape === "CIRCLE" ? "CIRCLE" : "RECT",
      backgroundColor: raw.backgroundColor ?? "#000000",
      cropInset: raw.cropInset ?? 0.06,
    };
  }

  // Legacy: focus 0–1 + zoom → approximate offsets / scale
  const zoom = raw.zoom && raw.zoom > 0 ? raw.zoom : 1;
  return {
    offsetX: ((raw.focusX ?? 0.5) - 0.5) * -2,
    offsetY: ((raw.focusY ?? 0.5) - 0.5) * -2,
    scaleX: zoom,
    scaleY: zoom,
    rotation: raw.rotation ?? 0,
    lockAspect: true,
    cropShape: "RECT",
    backgroundColor: "#000000",
    cropInset: 0.06,
  };
}
