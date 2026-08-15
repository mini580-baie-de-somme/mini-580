/** Shared image layout — client + server safe (no Node imports). */

export type CropAspectFormat =
  | "SQUARE"
  | "LANDSCAPE_16_9"
  | "LANDSCAPE_4_3"
  | "PORTRAIT_3_4"
  | "CIRCLE";

export const CROP_ASPECT_FORMATS: CropAspectFormat[] = [
  "SQUARE",
  "LANDSCAPE_16_9",
  "LANDSCAPE_4_3",
  "PORTRAIT_3_4",
  "CIRCLE",
];

export const CROP_FORMAT_LABELS: Record<
  CropAspectFormat,
  { fr: string; en: string }
> = {
  SQUARE: { fr: "Carré", en: "Square" },
  LANDSCAPE_16_9: { fr: "Paysage 16:9", en: "Landscape 16:9" },
  LANDSCAPE_4_3: { fr: "Paysage 4:3", en: "Landscape 4:3" },
  PORTRAIT_3_4: { fr: "Portrait 3:4", en: "Portrait 3:4" },
  CIRCLE: { fr: "Rond", en: "Round" },
};

export function resolveCropAspectFormat(raw?: string | null): CropAspectFormat {
  if (raw && CROP_ASPECT_FORMATS.includes(raw as CropAspectFormat)) {
    return raw as CropAspectFormat;
  }
  return "PORTRAIT_3_4";
}

export function imageAspectForFormat(format: CropAspectFormat): number {
  switch (format) {
    case "SQUARE":
    case "CIRCLE":
      return 1;
    case "LANDSCAPE_16_9":
      return 16 / 9;
    case "LANDSCAPE_4_3":
      return 4 / 3;
    case "PORTRAIT_3_4":
      return 3 / 4;
  }
}

/** Stage sizing — fillStage must fit inside parent without squashing aspect ratio. */
export function editorStageStyleForFormat(
  format: CropAspectFormat,
  opts?: { fillStage?: boolean }
): {
  aspectRatio: string;
  width?: string;
  height?: string;
  maxWidth?: string;
  maxHeight?: string;
} {
  const aspect = imageAspectForFormat(format);
  const fillStage = opts?.fillStage ?? false;
  if (fillStage) {
    return {
      aspectRatio: String(aspect),
      maxWidth: "100%",
      maxHeight: "100%",
      width: aspect >= 1 ? "100%" : "auto",
      height: aspect >= 1 ? "auto" : "100%",
    };
  }
  return {
    aspectRatio: String(aspect),
    width: "100%",
    maxWidth: "min(100%, 360px)",
  };
}

export function defaultCropShapeForFormat(format: CropAspectFormat): CropShape {
  return format === "CIRCLE" ? "CIRCLE" : "RECT";
}

function variantBox(longEdge: number, aspect: number): { w: number; h: number } {
  if (aspect >= 1) {
    return { w: longEdge, h: Math.round(longEdge / aspect) };
  }
  return { w: Math.round(longEdge * aspect), h: longEdge };
}

export function variantSizesForFormat(format: CropAspectFormat) {
  const aspect = imageAspectForFormat(format);
  return {
    picto: variantBox(128, aspect),
    petite: variantBox(384, aspect),
    moyenne: variantBox(768, aspect),
    grande: variantBox(1440, aspect),
  } as const;
}

/** @deprecated prefer imageAspectForFormat(cropAspectFormat) */
export const IMAGE_ASPECT = imageAspectForFormat("PORTRAIT_3_4");

/** @deprecated prefer variantSizesForFormat(cropAspectFormat) */
export const VARIANT_SIZE = variantSizesForFormat("PORTRAIT_3_4");

export type VariantKey = "picto" | "petite" | "moyenne" | "grande";

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
export const EDITOR_REFERENCE_SIZE = variantSizesForFormat("SQUARE").petite;

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

/** True circle inscribed in the crop window — matches rebake circle mask. */
export function cropCircleMetrics(crop: Pick<EditorCropWindow, "cropLeft" | "cropTop" | "cropW" | "cropH">) {
  const size = Math.min(crop.cropW, crop.cropH);
  return {
    cx: crop.cropLeft + crop.cropW / 2,
    cy: crop.cropTop + crop.cropH / 2,
    r: size / 2,
    left: crop.cropLeft + (crop.cropW - size) / 2,
    top: crop.cropTop + (crop.cropH - size) / 2,
    size,
  };
}

/**
 * Keep the crop-window center pinned on the same image point when scale changes.
 * Editor zoom resizes width/height (not CSS scale), so offset must track scale.
 */
export function offsetForScalePivot(
  offsetX: number,
  offsetY: number,
  prevScaleX: number,
  prevScaleY: number,
  nextScaleX: number,
  nextScaleY: number
): { offsetX: number; offsetY: number } {
  const factorX = prevScaleX !== 0 ? nextScaleX / prevScaleX : 1;
  const factorY = prevScaleY !== 0 ? nextScaleY / prevScaleY : 1;
  return {
    offsetX: offsetX * factorX,
    offsetY: offsetY * factorY,
  };
}

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

/** Axis-aligned bounds of a rotated rectangle — matches sharp.rotate output size. */
export function rotatedImageBounds(
  imageWidth: number,
  imageHeight: number,
  rotationDeg: number
): { width: number; height: number } {
  const iw = Math.max(1, imageWidth);
  const ih = Math.max(1, imageHeight);
  const rad = (rotationDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  return {
    width: iw * c + ih * s,
    height: iw * s + ih * c,
  };
}

/** Cover scale for the crop window — matches sharp after .rotate(). */
export function coverScaleForCrop(
  imageWidth: number,
  imageHeight: number,
  rotationDeg: number,
  cropW: number,
  cropH: number
): number {
  const rotated = rotatedImageBounds(imageWidth, imageHeight, rotationDeg);
  return Math.max(cropW / rotated.width, cropH / rotated.height);
}

/**
 * When rotation changes, coverScale changes too. Compensate scaleX/scaleY inversely
 * so the photo keeps the same visual size/zoom (rotate in place, WYSIWYG with rebake).
 */
export function layoutPatchForRotationChange(
  layout: ImageLayoutParams,
  nextRotation: number,
  imageWidth: number,
  imageHeight: number,
  cropW: number,
  cropH: number
): Partial<ImageLayoutParams> {
  const prevCover = coverScaleForCrop(
    imageWidth,
    imageHeight,
    layout.rotation,
    cropW,
    cropH
  );
  const nextCover = coverScaleForCrop(
    imageWidth,
    imageHeight,
    nextRotation,
    cropW,
    cropH
  );
  const coverRatio = prevCover > 0 ? nextCover / prevCover : 1;
  const nextScaleX = layout.scaleX / coverRatio;
  const nextScaleY = layout.lockAspect ? nextScaleX : layout.scaleY / coverRatio;

  return {
    rotation: nextRotation,
    scaleX: nextScaleX,
    scaleY: nextScaleY,
  };
}

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

  // Cover scale uses post-rotation bounds (matches sharp after .rotate()).
  // Preview draws the unrotated bitmap, then CSS rotate — box size uses source iw/ih.
  const coverScale = coverScaleForCrop(iw, ih, layout.rotation, cropW, cropH);
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
  cropAspectFormat?: string | null;
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
  const format = resolveCropAspectFormat(raw.cropAspectFormat);
  const scaleX = resolveScale(raw.scaleX, raw.zoom);
  const scaleY = resolveScale(raw.scaleY ?? raw.scaleX, raw.zoom);

  return {
    offsetX: resolveOffset(raw.offsetX, raw.focusX),
    offsetY: resolveOffset(raw.offsetY, raw.focusY),
    scaleX,
    scaleY,
    rotation: raw.rotation ?? 0,
    lockAspect: raw.lockAspect ?? true,
    cropShape:
      raw.cropShape === "CIRCLE" || format === "CIRCLE"
        ? "CIRCLE"
        : "RECT",
    backgroundColor: raw.backgroundColor ?? "#000000",
    cropInset: raw.cropInset ?? 0.06,
  };
}

export function cropAspectFormatFromLegacy(
  raw: LegacyMediaTransform
): CropAspectFormat {
  return resolveCropAspectFormat(raw.cropAspectFormat);
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

const LAYOUT_COMPARE_KEYS: (keyof ImageLayoutParams)[] = [
  "offsetX",
  "offsetY",
  "scaleX",
  "scaleY",
  "rotation",
  "lockAspect",
  "cropShape",
  "backgroundColor",
  "cropInset",
];

/** Compare layout params for save guards (avoid silent layout drop). */
export function layoutParamsEqual(
  a: ImageLayoutParams,
  b: ImageLayoutParams,
  epsilon = 1e-4
): boolean {
  for (const key of LAYOUT_COMPARE_KEYS) {
    const av = a[key];
    const bv = b[key];
    if (key === "lockAspect") {
      if (Boolean(av) !== Boolean(bv)) return false;
      continue;
    }
    if (key === "cropShape" || key === "backgroundColor") {
      if (String(av) !== String(bv)) return false;
      continue;
    }
    if (Math.abs(Number(av) - Number(bv)) > epsilon) return false;
  }
  return true;
}

export function layoutParamsDiffer(
  a: ImageLayoutParams,
  b: ImageLayoutParams,
  epsilon?: number
): boolean {
  return !layoutParamsEqual(a, b, epsilon);
}
