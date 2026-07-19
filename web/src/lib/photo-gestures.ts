/** Pure helpers for multi-touch photo canvas gestures (testable, no DOM). */

export type Point = { x: number; y: number };

export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

/** Angle in degrees from a → b (0 = east, positive = clockwise). */
export function angleDeg(a: Point, b: Point): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

export type PinchSnapshot = {
  distance: number;
  angleDeg: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
};

export function pinchSnapshot(
  p1: Point,
  p2: Point,
  scaleX: number,
  scaleY: number,
  rotation: number,
  offsetX: number,
  offsetY: number
): PinchSnapshot {
  return {
    distance: distance(p1, p2),
    angleDeg: angleDeg(p1, p2),
    scaleX,
    scaleY,
    rotation,
    offsetX,
    offsetY,
  };
}

export function scaleFromPinch(
  start: PinchSnapshot,
  currentDistance: number,
  lockAspect: boolean
): { scaleX: number; scaleY: number } {
  if (start.distance <= 0 || currentDistance <= 0) {
    return { scaleX: start.scaleX, scaleY: start.scaleY };
  }
  const factor = currentDistance / start.distance;
  const scaleX = start.scaleX * factor;
  const scaleY = lockAspect ? scaleX : start.scaleY * factor;
  return { scaleX, scaleY };
}

export function rotationFromPinch(
  start: PinchSnapshot,
  currentAngleDeg: number
): number {
  return start.rotation + (currentAngleDeg - start.angleDeg);
}

/** Pinch zoom/rotate — scale relative to gesture start, offset pivots on crop center. */
export function layoutFromPinch(
  start: PinchSnapshot,
  currentDistance: number,
  currentAngleDeg: number,
  lockAspect: boolean
): {
  scaleX: number;
  scaleY: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
} {
  const scaled = scaleFromPinch(start, currentDistance, lockAspect);
  const factorX = start.scaleX !== 0 ? scaled.scaleX / start.scaleX : 1;
  const factorY = start.scaleY !== 0 ? scaled.scaleY / start.scaleY : 1;
  return {
    scaleX: scaled.scaleX,
    scaleY: scaled.scaleY,
    rotation: rotationFromPinch(start, currentAngleDeg),
    offsetX: start.offsetX * factorX,
    offsetY: start.offsetY * factorY,
  };
}
