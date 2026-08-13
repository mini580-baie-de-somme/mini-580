/** Pure helpers for horizontal swipe navigation (slideshow, galleries). */

export type SwipeDelta = { deltaX: number; deltaY: number };

export type SwipeOptions = {
  /** Minimum horizontal travel in px to count as a swipe. */
  minDistance?: number;
  /** Horizontal must exceed vertical by this factor (avoids scroll conflicts). */
  minRatio?: number;
};

/**
 * Resolve a horizontal swipe into navigation direction.
 * - Swipe left (finger moves left, negative deltaX) → next (+1)
 * - Swipe right → previous (-1)
 * - Ambiguous / too short → 0
 */
export function resolveHorizontalSwipe(
  { deltaX, deltaY }: SwipeDelta,
  options: SwipeOptions = {}
): -1 | 0 | 1 {
  const minDistance = options.minDistance ?? 48;
  const minRatio = options.minRatio ?? 1.25;

  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absX < minDistance) return 0;
  if (absY > 0 && absX < absY * minRatio) return 0;

  return deltaX < 0 ? 1 : -1;
}
