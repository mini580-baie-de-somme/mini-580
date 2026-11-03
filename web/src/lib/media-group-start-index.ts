/** Clamp a mosaic click index into a valid group slideshow start position. */
export function clampMediaGroupStartIndex(
  startIndex: number,
  memberCount: number
): number {
  if (memberCount <= 0) return 0;
  if (!Number.isFinite(startIndex)) return 0;
  return Math.max(0, Math.min(Math.floor(startIndex), memberCount - 1));
}
