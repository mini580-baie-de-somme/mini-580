/** Pure helpers for multi-touch photo canvas gestures (testable, no DOM). */

import { offsetForScalePivot } from "@/lib/image-layout";

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

export type PinchCoverContext = {
  /** coverScaleForCrop at gesture start rotation */
  startCoverScale: number;
  /** coverScaleForCrop at current rotation */
  nextCoverScale: number;
};

/** Pinch zoom/rotate — scale relative to gesture start, offset pivots on crop center. */
export function layoutFromPinch(
  start: PinchSnapshot,
  currentDistance: number,
  currentAngleDeg: number,
  lockAspect: boolean,
  cover?: PinchCoverContext
): {
  scaleX: number;
  scaleY: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
} {
  const startCover = cover?.startCoverScale ?? 1;
  const nextRotation = rotationFromPinch(start, currentAngleDeg);
  const nextCover = cover?.nextCoverScale ?? startCover;
  const pinchFactor =
    start.distance > 0 && currentDistance > 0 ? currentDistance / start.distance : 1;

  const startEffectiveX = startCover * start.scaleX;
  const startEffectiveY = startCover * start.scaleY;
  const nextEffectiveX = startEffectiveX * pinchFactor;
  const nextEffectiveY = startEffectiveY * pinchFactor;

  const nextScaleX = nextCover > 0 ? nextEffectiveX / nextCover : start.scaleX;
  const nextScaleY =
    lockAspect
      ? nextScaleX
      : nextCover > 0
        ? nextEffectiveY / nextCover
        : start.scaleY;

  const offset = offsetForScalePivot(
    start.offsetX,
    start.offsetY,
    startEffectiveX,
    startEffectiveY,
    nextCover * nextScaleX,
    nextCover * nextScaleY
  );

  return {
    scaleX: nextScaleX,
    scaleY: nextScaleY,
    rotation: nextRotation,
    offsetX: offset.offsetX,
    offsetY: offset.offsetY,
  };
}
