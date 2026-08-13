/** Pure helpers for horizontal swipe navigation (slideshow, galleries). */

export type SwipeDelta = { deltaX: number; deltaY: number };

export type SwipeOptions = {
  /** Minimum horizontal travel in px to count as a swipe. */
  minDistance?: number;
  /** Horizontal must exceed vertical by this factor (avoids scroll conflicts). */
  minRatio?: number;
};

const DEFAULT_MIN_DISTANCE = 48;
const DEFAULT_MIN_RATIO = 1.25;

function swipeMetrics(
  { deltaX, deltaY }: SwipeDelta,
  options: SwipeOptions = {}
) {
  const minDistance = options.minDistance ?? DEFAULT_MIN_DISTANCE;
  const minRatio = options.minRatio ?? DEFAULT_MIN_RATIO;
  return {
    minDistance,
    minRatio,
    absX: Math.abs(deltaX),
    absY: Math.abs(deltaY),
  };
}

/**
 * True when finger movement is clearly horizontal (used during touchmove to
 * block background scroll without waiting for release threshold).
 */
export function isHorizontalSwipeGesture(
  delta: SwipeDelta,
  options: SwipeOptions & { moveThreshold?: number } = {}
): boolean {
  const moveThreshold = options.moveThreshold ?? 12;
  const { minRatio, absX, absY } = swipeMetrics(delta, options);

  if (absX < moveThreshold && absY < moveThreshold) return false;
  if (absY > absX * minRatio) return false;
  return absX >= moveThreshold;
}

/**
 * True when vertical movement should win inside a scrollable region (e.g. PDF).
 */
export function isVerticalScrollGesture(
  delta: SwipeDelta,
  options: SwipeOptions & { moveThreshold?: number } = {}
): boolean {
  const moveThreshold = options.moveThreshold ?? 12;
  const { minRatio, absX, absY } = swipeMetrics(delta, options);

  if (absX < moveThreshold && absY < moveThreshold) return false;
  return absY > absX * minRatio;
}

/**
 * Target translateX offset (px) added to the centered (-100%) track position
 * so the outgoing slide exits in the same direction as the finger.
 * Swipe left (next) → negative offset; swipe right (prev) → positive offset.
 */
export function getSwipeSnapTranslateX(
  direction: -1 | 1,
  containerWidth: number
): number {
  if (containerWidth <= 0) return direction === 1 ? -120 : 120;
  return direction === 1 ? -containerWidth : containerWidth;
}

/**
 * Resolve a horizontal swipe into navigation direction.
 * - Swipe left (finger moves left, negative deltaX) → next (+1)
 * - Swipe right → previous (-1)
 * - Ambiguous / too short → 0
 */
export function resolveHorizontalSwipe(
  delta: SwipeDelta,
  options: SwipeOptions = {}
): -1 | 0 | 1 {
  const { minDistance, minRatio, absX, absY } = swipeMetrics(delta, options);

  if (absX < minDistance) return 0;
  if (absY > 0 && absX < absY * minRatio) return 0;

  return delta.deltaX < 0 ? 1 : -1;
}
