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

export function clampCropInset(cropInset: number): number {
  return Math.min(0.4, Math.max(0, cropInset));
}

/** Crop window as fractions of the stage (0–1). */
export function cropWindowFractions(cropInset: number) {
  const inset = clampCropInset(cropInset);
  const cropW = 1 - 2 * inset;
  const cropH = 1 - 2 * inset;
  return { inset, cropLeft: inset, cropTop: inset, cropW, cropH };
}

/**
 * Fixed logical canvas for editor crop/layout — decoupled from on-screen stage resize
 * (e.g. mobile bottom-sheet handle must not change crop pixel size).
 */
export const EDITOR_REFERENCE_SIZE = VARIANT_SIZE.petite;

export type EditorCropWindow = {
  cropLeft: number;
  cropTop: number;
  cropW: number;
  cropH: number;
  refLeft: number;
  refTop: number;
  refW: number;
  refH: number;
};

/** Crop window in stage pixels — proportional to stage size (editor preview only). */
export function computeEditorCropWindow(
  cropInset: number,
  stageWidth: number,
  stageHeight: number
): EditorCropWindow {
  const inset = clampCropInset(cropInset);
  const refW = Math.max(1, stageWidth);
  const refH = Math.max(1, stageHeight);
  const cropW = refW * (1 - 2 * inset);
  const cropH = refH * (1 - 2 * inset);
  return {
    refLeft: 0,
    refTop: 0,
    refW,
    refH,
    cropLeft: refW * inset,
    cropTop: refH * inset,
    cropW,
    cropH,
  };
}

export type EditorPhotoLayoutInput = {
  layout: ImageLayoutParams;
  stageWidth: number;
  stageHeight: number;
  imageWidth: number;
  imageHeight: number;
};

/** Pixel placement for the editor preview — mirrors `applyImageTransform` in media-variants. */
export function computeEditorPhotoLayout(input: EditorPhotoLayoutInput): {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotation: number;
} {
  const { layout, stageWidth, stageHeight, imageWidth, imageHeight } = input;
  const iw = Math.max(1, imageWidth);
  const ih = Math.max(1, imageHeight);
  const W = Math.max(1, stageWidth);
  const H = Math.max(1, stageHeight);

  const { cropLeft, cropTop, cropW, cropH } = computeEditorCropWindow(
    layout.cropInset,
    W,
    H
  );

  const coverScale = Math.max(cropW / iw, cropH / ih);
  const width = Math.max(1, iw * coverScale * layout.scaleX);
  const height = Math.max(1, ih * coverScale * layout.scaleY);

  const centerX = cropLeft + cropW / 2 + layout.offsetX * cropW;
  const centerY = cropTop + cropH / 2 + layout.offsetY * cropH;

  return {
    centerX,
    centerY,
    width,
    height,
    rotation: layout.rotation,
  };
}

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

export type LegacyMediaTransform = {
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
};

function resolveScale(
  rawScale: number | null | undefined,
  rawZoom: number | null | undefined
): number {
  const zoom = rawZoom != null && rawZoom > 0 ? rawZoom : 1;
  if (rawScale != null && (rawScale !== 1 || Math.abs(zoom - 1) < 1e-6)) {
    return rawScale;
  }
  return zoom;
}

function resolveOffset(
  rawOffset: number | null | undefined,
  focus: number | null | undefined
): number {
  const focusVal = focus ?? 0.5;
  const legacy = (focusVal - 0.5) * -2;
  if (rawOffset != null && (rawOffset !== 0 || Math.abs(focusVal - 0.5) < 1e-6)) {
    return rawOffset;
  }
  return legacy;
}

/** Map legacy Media transform fields → layout params. */
export function layoutFromLegacy(raw: LegacyMediaTransform): ImageLayoutParams {
  const scaleX = resolveScale(raw.scaleX, raw.zoom);
  const scaleY = resolveScale(
    raw.scaleY ?? raw.scaleX,
    raw.zoom
  );

  return {
    offsetX: resolveOffset(raw.offsetX, raw.focusX),
    offsetY: resolveOffset(raw.offsetY, raw.focusY),
    scaleX,
    scaleY,
    rotation: raw.rotation ?? 0,
    lockAspect: raw.lockAspect ?? true,
    cropShape: raw.cropShape === "CIRCLE" ? "CIRCLE" : "RECT",
    backgroundColor: raw.backgroundColor ?? "#000000",
    cropInset: raw.cropInset ?? 0.06,
  };
}

/** Keep legacy focus/zoom columns aligned when saving new layout fields. */
export function legacyFieldsFromLayout(layout: ImageLayoutParams): {
  focusX: number;
  focusY: number;
  zoom: number;
} {
  return {
    focusX: 0.5 - layout.offsetX / 2,
    focusY: 0.5 - layout.offsetY / 2,
    zoom: layout.lockAspect
      ? layout.scaleX
      : Math.max(layout.scaleX, layout.scaleY),
  };
}

/** Merge a partial layout patch onto stored media before bake/persist. */
export function mergeLayoutPatch(
  existing: LegacyMediaTransform,
  patch: Partial<ImageLayoutParams>
): ImageLayoutParams {
  return layoutFromLegacy({ ...existing, ...patch });
}

/** Layout used for server-side rebake — prefer explicit patch over DB round-trip. */
export function layoutForRebake(
  existing: LegacyMediaTransform,
  patch: Partial<ImageLayoutParams>
): ImageLayoutParams {
  if (Object.keys(patch).length > 0) {
    return mergeLayoutPatch(existing, patch);
  }
  return layoutFromLegacy(existing);
}
